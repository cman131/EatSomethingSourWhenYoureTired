use std::{collections::HashMap, str::FromStr};

use actix_cors::Cors;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer, Result};
use chrono::{DateTime, Duration, Utc};
use config::Config;
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use rand::{self, distributions::Alphanumeric, Rng};
use mongodb::{ bson::{doc, oid::ObjectId}, Client, Database };
use lettre::{transport::smtp::authentication::Credentials, Message, SmtpTransport, Transport};

#[derive(Serialize)]
#[derive(Deserialize)]
struct AuthenticatedSessionId {
    session_id: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    message: String,
}

#[derive(Deserialize)]
struct UserCredentials {
    email: String,
    code: String,
    ip_address: String
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct MatchPlayer {
    id: Option<ObjectId>,
    unregistered_name: Option<String>,
    score: i32,
}

#[derive(Serialize, Deserialize, Debug)]
struct Match {
    _id: Option<ObjectId>,
    players: Vec<MatchPlayer>,
    date: String
}

#[derive(Serialize, Deserialize, Debug)]
struct User {
    _id: ObjectId,
    name: Option<String>,
    majsoul_username: Option<String>,
    discord_username: Option<String>,
    email: String,
    session_id: Option<String>,
    code: String,
    code_date: String,
    match_history: Vec<Match>,
    avatar: Option<String>
}
impl User {
    pub fn new(email: String, code: String, code_date: String, match_history: Vec<Match>) -> Self {
        Self { _id: ObjectId::new(), name: None, majsoul_username: None, discord_username: None, email, session_id: None, code, code_date, match_history, avatar: None }
    }
    pub fn details(user: User) -> Self {
        Self { _id: user._id, name: user.name, majsoul_username: user.majsoul_username, discord_username: user.discord_username, email: user.email, session_id: None, code: "".to_string(), code_date: "".to_string(), match_history: user.match_history, avatar: user.avatar }
    }
    pub fn member_view(user: &User) -> Self {
        Self { _id: user._id, name: user.name.to_owned(), majsoul_username: None, discord_username: None, email: user.email.to_owned(), session_id: None, code: "".to_string(), code_date: "".to_string(), match_history: Vec::new(), avatar: user.avatar.to_owned() }
    }
}

#[derive(Deserialize)]
struct UserEmail {
    email: String,
}

#[derive(Deserialize)]
struct UserAvatar {
    email: String,
    avatar: String,
}

async fn get_user(req: HttpRequest, client: web::Data<Client>, config: web::Data<HashMap<String, String>>, info: web::Json<UserEmail>) -> HttpResponse {
    let database = client.database(config["db_name"].as_str());

    return match get_user_internal(database, req, info.email.to_string(), true).await {
        Ok(user) => HttpResponse::Ok().json(User::details(user)),
        Err(error) => error
    };
}

async fn get_member_list(client: web::Data<Client>, config: web::Data<HashMap<String, String>>) -> HttpResponse {
    let database = client.database(config["db_name"].as_str());
    let collection = database.collection::<User>("users");
    let cursor = collection.find(None, None).await.unwrap();

    let users = cursor.try_collect().await.unwrap_or_else(|_| vec![]);
    let members: Vec<User> = users.iter().map(|user| User::member_view(user)).collect();
    HttpResponse::Ok().json(members)
}

async fn update_user_avatar(req: HttpRequest, client: web::Data<Client>, config: web::Data<HashMap<String, String>>, info: web::Json<UserAvatar>) -> HttpResponse {
    let database = client.database(config["db_name"].as_str());
    let collection = database.collection::<User>("users");

    let user = get_user_internal(database.to_owned(), req, info.email.to_string(), false).await;
    if user.is_err() {
        return user.unwrap_err();
    }

    collection.update_one(doc! { "email": info.email.to_uppercase() }, doc! { "$set": {
        "avatar": info.avatar.to_owned(),
    } }, None).await.expect("Failed to update user");
    return HttpResponse::NoContent().json(ErrorResponse { message: "User avatar updated".to_string() });
}

async fn update_user(req: HttpRequest, client: web::Data<Client>, config: web::Data<HashMap<String, String>>, info: web::Json<User>) -> HttpResponse {
    let database = client.database(config["db_name"].as_str());
    let collection = database.collection::<User>("users");

    let user = get_user_internal(database.to_owned(), req, info.email.to_string(), false).await;
    if user.is_err() {
        return user.unwrap_err();
    }

    collection.update_one(doc! { "email": info.email.to_uppercase() }, doc! { "$set": {
        "name": info.name.to_owned(),
        "email": info.email.to_uppercase(),
        "discord_username": info.discord_username.to_owned(),
        "majsoul_username": info.majsoul_username.to_owned()
    } }, None).await.expect("Failed to update user");
    return HttpResponse::NoContent().json(ErrorResponse { message: "User updated".to_string() });
}

async fn save_match(req: HttpRequest, client: web::Data<Client>, config: web::Data<HashMap<String, String>>, info: web::Json<Match>) -> HttpResponse {
    let database = client.database(config["db_name"].as_str());
    let user = get_user_internal_by_id(database.to_owned(), req, info.players[0].id.unwrap()).await;
    if user.is_err() {
        return HttpResponse::Forbidden().json(ErrorResponse { message: "User not authenticated".to_string() });
    }

    let match_collection = database.collection::<Match>("matches");
    let match_value = Match { _id: Some(ObjectId::new()), players: info.players.to_vec(), date: Utc::now().to_rfc3339() };
    match_collection.insert_one(match_value, None).await.expect("Failed to create match");

    return HttpResponse::NoContent().json(ErrorResponse { message: "Match created".to_string() });
}

async fn get_user_internal_by_id(database: Database, req: HttpRequest, id: ObjectId) -> Result<User, HttpResponse> {
    let collection = database.collection::<User>("users");
    let existing = collection.find_one(doc! { "_id": id }, None)
        .await.expect("Failed to find user");

    if existing.is_none() {
        return Err(HttpResponse::NotFound().json(ErrorResponse { message: "User not found".to_string() }));
    }

    let some_existing = existing.unwrap();

    // Failed authentication
    if !check_authentication(req, some_existing.session_id.to_owned()) {
        return Err(HttpResponse::Forbidden().json(ErrorResponse { message: "User not authenticated".to_string() }));
    }
    return Ok(some_existing);
}

async fn get_events_list() -> HttpResponse {
  return match reqwest::get("https://www.meetup.com/_next/data/d10114fc400472e5cd0a026a4690f7b567613904/en-US/charleston-riichi-mahjong/events.json?slug=charleston-riichi-mahjong").await {
      Ok(resp) => match resp.json::<serde_json::Value>().await {
        Ok(response) => HttpResponse::Ok().json(response), 
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse { message: error.to_string() })
      },
      Err(error) => HttpResponse::BadRequest().json(ErrorResponse { message: error.to_string() })
    };
}

async fn get_user_internal(database: Database, req: HttpRequest, email: String, include_matches: bool) -> Result<User, HttpResponse> {
    let collection = database.collection::<User>("users");
    let existing = collection.find_one(doc! { "email": email.to_uppercase() }, None)
        .await.expect("Failed to find user");

    if existing.is_none() {
        return Err(HttpResponse::NotFound().json(ErrorResponse { message: "User not found".to_string() }));
    }

    let mut some_existing = existing.unwrap();

    // Failed authentication
    if !check_authentication(req, some_existing.session_id.to_owned()) {
        return Err(HttpResponse::Forbidden().json(ErrorResponse { message: "User not authenticated".to_string() }));
    }

    if include_matches {
        let cursor = database.collection::<Match>("matches")
            .find(doc! { "players": { "$elemMatch": { "id": some_existing._id } } }, None)
            .await.expect("Failed to grab matches");

        let matches = cursor.try_collect().await.unwrap_or_else(|_| vec![]);
        some_existing.match_history = matches;
    }
    return Ok(some_existing);
}

fn check_authentication(req: HttpRequest, session_id: Option<String>) -> bool {
    let header = req.headers().get("Authentication-Session-Id");
    if header.is_some() {
        let session_id_input = header.unwrap().to_str().ok();
        return !session_id_input.is_none() && session_id == session_id;
    }
    return false;
}

async fn login(client: web::Data<Client>, config: web::Data<HashMap<String, String>>, info: web::Json<UserCredentials>) -> HttpResponse {
    let database = client.database(config["db_name"].as_str());
    let collection = database.collection::<User>("users");

    let existing = collection.find_one(doc! { "email": info.email.to_uppercase() }, None)
        .await.expect("Failed to find user");
    if existing.is_none() {
        return HttpResponse::NotFound().json(ErrorResponse { message: "User not found".to_string() });
    }

    let some_existing = existing.unwrap();
    let now = Utc::now();
    let code_date_expiration = DateTime::parse_from_rfc3339(&some_existing.code_date).unwrap().with_timezone(&Utc) + Duration::minutes(1);

    // Invalid code
    if some_existing.code != info.code || now >= code_date_expiration {
        let reason = if some_existing.code != info.code { "Invalid" } else { "Expired" };
        return HttpResponse::Forbidden().json(ErrorResponse { message: format!("{} authorization code", reason).to_string() });
    }
    let session_id = uuid::Uuid::new_v4();
    collection.update_one(doc! { "email": info.email.to_uppercase() }, doc! { "$set": { "session_id": session_id.to_string(), "ip_address": info.ip_address.to_string() } }, None)
        .await.expect("Failed to update user");

    HttpResponse::Ok().json(AuthenticatedSessionId { session_id: session_id.to_string() })
}

async fn send_code(client: web::Data<Client>, config: web::Data<HashMap<String, String>>, info: web::Json<UserEmail>) -> HttpResponse {
    let code = generate_code();
    let code_date = Utc::now().to_rfc3339();

    let database = client.database(config["db_name"].as_str());
    let collection = database.collection::<User>("users");

    let existing = collection.find_one(doc! { "email": info.email.to_uppercase() }, None)
        .await.expect("Failed to find user");

    // Our user
    if !existing.is_none() {
        collection.update_one(doc! { "email": info.email.to_uppercase() }, doc! { "$set": { "code": code.to_string(), "code_date": code_date } }, None).await.expect("Failed to replace user");
    } else {
        let user = User::new(info.email.to_uppercase(), code.to_string(), code_date, Vec::new());
        collection.insert_one(user, None).await.expect("Failed to insert user");
    };

    send_email(config, info.email.to_string(), code).await.expect("Failed to send email");

    HttpResponse::Ok().body("Sent.")
}

async fn send_email(config: web::Data<HashMap<String, String>>, email: String, code: String) -> Result<()> {
    let email = Message::builder()
        .from("CHS Riichi Mahjong <charlestonriichimahjong@gmail.com>".parse().unwrap())
        .to(email.parse().unwrap())
        .subject("CHS Riichi Mahjong Authentication Code")
        .body(String::from(format!("Hello! Here is your one-time auth-code: {}", code)))
        .unwrap();

    // Create SMTP client credentials using username and password
    let creds = Credentials::new(config["email"].to_string(), config["email_pass"].to_string()); 
    let mailer = SmtpTransport::starttls_relay(config["email_server_name"].as_str())
        .unwrap()  // Unwrap the Result, panics in case of error
        .credentials(creds)  // Provide the credentials to the transport
        .build();  // Construct the transport

    // Attempt to send the email via the SMTP transport
    match mailer.send(&email) { 
        // If email was sent successfully, print confirmation message
        Ok(_) => println!("Email sent successfully!"), 
        // If there was an error sending the email, print the error
        Err(e) => eprintln!("Could not send email: {:?}", e), 
    }
    Ok(())
}

fn generate_code() -> String {
    return rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(7)
        .map(char::from)
        .collect();
}

fn get_config() -> HashMap<String, String> {
    let settings = Config::builder()
        // Add in `./Settings.toml`
        .add_source(config::File::with_name("config.secrets"))
        // Add in settings from the environment (with a prefix of APP)
        // Eg.. `APP_DEBUG=1 ./target/app` would set the `debug` key
        .add_source(config::Environment::with_prefix("APP"))
        .build()
        .unwrap();

    return settings
        .try_deserialize::<HashMap<String, String>>()
        .unwrap();
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let config = get_config();
    let cors_allowed_origin = config["origin"].to_string();
    let port = u16::from_str(config["port"].as_str()).expect("bad config");
    let client = Client::with_uri_str(config["db_uri"].to_string()).await.expect("failed to connect");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&cors_allowed_origin)
            .allow_any_header()
            .allow_any_method()
            .expose_any_header();
        App::new()
            .app_data(web::Data::new(client.clone()))
            .app_data(web::Data::new(config.clone()))
            .wrap(cors)
            .route("/requestcode", web::post().to(send_code))
            .route("/login", web::post().to(login))
            .route("/getuser", web::post().to(get_user))
            .route("/getmembers", web::get().to(get_member_list))
            .route("/getevents", web::get().to(get_events_list))
            .route("/updateuser", web::post().to(update_user))
            .route("/updateuseravatar", web::post().to(update_user_avatar))
            .route("/savematch", web::post().to(save_match))
    })
    .bind(("127.0.0.1", port))?
    .run()
    .await
}