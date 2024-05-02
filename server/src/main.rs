use actix_cors::Cors;
use actix_web::{web::{self}, App, HttpResponse, HttpServer};
use serde::Serialize;

#[derive(Serialize)]
struct RetVal {
    message: String,
}

async fn index() -> HttpResponse {
    HttpResponse::Ok().json(RetVal { message: "Hello".to_string() })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        let cors_allowed_origin = "http://localhost:3000";
        let cors = Cors::default()
            .allowed_origin(&cors_allowed_origin)
            .allow_any_header()
            .allow_any_method()
            .expose_any_header();
        App::new()
            .wrap(cors)
            .route("/", web::get().to(index))
            .route("/api/text", web::get().to(index))
            .route("/user", web::post().to(index))
    })
    .bind(("127.0.0.1", 8000))?
    .run()
    .await
}