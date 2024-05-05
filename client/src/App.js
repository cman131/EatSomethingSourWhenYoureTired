import { Routes, Route, Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import './App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExternalLink, faBars, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import ProfilePic from "./profile-picture";
const config = require('./config');

export default function App() {
  const [user, setUser] = getState();
  const navigate = useNavigate();

  function getState() {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    return [user, updateUser];
  }

  function updateUser(userChanges) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  function Login() {
    const [error, setError] = useState(undefined);

    async function SendCode() {
      const body = {
        email: document.querySelector('#email').value,
      };

      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      };
      const response = await fetch(`${config.siteBaseUrl}/requestcode`, requestOptions);
      if (response.ok) {
        setUser({ email: body.email, codeSent: true, session_id: undefined });
      }
    }

    async function SendLogin() {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ip = await ipResponse.json();
      const body = {
        email: document.querySelector('#email').value,
        code: document.querySelector('#code').value,
        ip_address: ip.ip
      };
      console.log(body);
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      };

      setError(undefined);
      const response = await fetch(`${config.siteBaseUrl}/login`, requestOptions);
      const data = await response.json();
      if (response.ok) {
        setUser({ email: body.email, codeSent: false, session_id: data.session_id });
        navigate("/profile");
      } else {
        setError(data.message);
      }
    }

    return (
      <div className="form">
        <h2>Login</h2>
        <label>
          Email
          <input id="email" type="email" name="email" defaultValue={user.email} />
        </label>
        <label>
          Authentication Code
          <input id="code" type="password" name="code" defaultValue={user.code} />
          <button className="btn btn-secondary" onClick={SendCode}>Send code</button>
        </label>
        { error &&
          <p className="error-banner">{error}</p>
        }
        <button className="btn btn-primary" onClick={SendLogin}>Login</button>
      </div>
    );
  }

  function Layout() {
    const { pathname } = useLocation();
    return (
      <div>
        <nav>
          <ul>
            <li className={pathname === "/" ? "current" : ""}>
              <Link title="Home" to="/">
                <img alt="CHS Riichi Club Logo" src="./logo_alpha.png" />
                <h1>Charleston Riichi Mahjong</h1>
              </Link>
            </li>
            <li className={pathname === "/events" ? "current" : ""}>
              <Link title="Events" to="/events">Events</Link>
            </li>
            <li className={pathname === "/tournaments" ? "current" : ""}>
              <Link title="Tournaments" to="/tournaments">Tournaments</Link>
            </li>
            <li className={pathname === "/resources" ? "current" : ""}>
              <Link title="Resources" to="/resources">Resources</Link>
            </li>
            <li>
              <a title="Merch Shop" rel="noreferrer" target="_blank" href="https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club">Merch Shop<FontAwesomeIcon icon={faExternalLink} /></a>
            </li>
            <li>
              <a title="Meetup" rel="noreferrer" target="_blank" href="https://www.meetup.com/charleston-riichi-mahjong/">Meetup<FontAwesomeIcon icon={faExternalLink} /></a>
            </li>
            <li>
              <a title="Discord Server" rel="noreferrer" target="_blank" href="https://discord.gg/xhZtZZF3Jk">Discord Server<FontAwesomeIcon icon={faExternalLink} /></a>
            </li>
            { !user?.session_id &&
              <li className={pathname === "/login" ? "current" : ""}>
                <Link title="Login" to="/login">Login</Link>
              </li>
            }
            { user?.session_id &&
              <li className={pathname === "/profile" ? "current" : ""}>
                <Link title="Profile" to="/profile">Profile</Link>
              </li>
            }
            { user?.session_id &&
              <li className={pathname === "/report_match" ? "current" : ""}>
                <Link title="Report Match" to="/report_match">Report Match</Link>
              </li>
            }
            <li className="mobile menu-btn">
              <button className="btn secondary-btn" onClick={toggleMobileNavigation}><FontAwesomeIcon icon={faBars} /></button>
            </li>
          </ul>
        </nav>
        <div className="mobile mobile-nav-menu hidden">
          <button className="btn secondary-btn back-btn" onClick={toggleMobileNavigation}><FontAwesomeIcon icon={faArrowLeft} /></button>
          <ul onClick={toggleMobileNavigation}>
            <li className={pathname === "/" ? "current" : ""}>
              <Link title="Home" to="/">Home</Link>
            </li>
            <li className={pathname === "/events" ? "current" : ""}>
              <Link title="Events" to="/events">Events</Link>
            </li>
            <li className={pathname === "/tournaments" ? "current" : ""}>
              <Link title="Tournaments" to="/tournaments">Tournaments</Link>
            </li>
            <li className={pathname === "/resources" ? "current" : ""}>
              <Link title="Resources" to="/resources">Resources</Link>
            </li>
            <li>
              <a title="Merch Shop" rel="noreferrer" target="_blank" href="https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club">Merch Shop<FontAwesomeIcon icon={faExternalLink} /></a>
            </li>
            <li>
              <a title="Meetup" rel="noreferrer" target="_blank" href="https://www.meetup.com/charleston-riichi-mahjong/">Meetup<FontAwesomeIcon icon={faExternalLink} /></a>
            </li>
            <li>
              <a title="Discord Server" rel="noreferrer" target="_blank" href="https://discord.gg/xhZtZZF3Jk">Discord Server<FontAwesomeIcon icon={faExternalLink} /></a>
            </li>
            { !user?.session_id &&
              <li className={pathname === "/login" ? "current" : ""}>
                <Link title="Login" to="/login">Login</Link>
              </li>
            }
            { user?.session_id &&
              <li className={pathname === "/profile" ? "current" : ""}>
                <Link title="Profile" to="/profile">Profile</Link>
              </li>
            }
          </ul>
        </div>

        <Outlet />
      </div>
    );
  }

  function toggleMobileNavigation() {
    const element = document.querySelector('.mobile-nav-menu');
    if (element.classList.contains('hidden')) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  }

  function Home() {
    return (
      <div className="text-content">
        <h3>Welcome to Charleston's Riichi Mahjong Club!</h3>
        <p>
          We primarily play 10am - 12pm every Sunday at Mercantile and Mash downtown.
        </p>
        <br/><br/>
        <h3>What is Riichi Mahjong?</h3>
        <p>
          Riichi mahjong is a Japanese variant of the ancient Chinese game of Mahjong - similar to Gin Rummy or Phase 10.
          <br/>
          All skill levels are welcome and we're happy to teach! Come learn to play {":)"}
        </p>
      </div>
    );
  }

  function Events() {
    return (
      <div className="event-pane">
        <iframe src='https://widgets.sociablekit.com/meetup-group-events/iframe/25406359' frameborder='0' width='100%' height='100%' title="Upcoming events"></iframe>
      </div>
    );
  }

  function Resources() {
    return (
      <div>
        <div className="link-list">
          <h2>Learning Resources</h2>
          <ul>
            <li><a rel="noreferrer" target="_blank" href="https://docs.google.com/document/d/1vtuRiT5a6QBx7ggaOQ5P4SlnySxssZxbX6uZeHKYzOI/edit?usp=sharing">Yaku Reference Book</a></li>
            <li><a rel="noreferrer" target="_blank" href="https://docs.google.com/document/d/1Cai2O3TsZyv3nV-gXU46I6taYoDFjlutNiOxS2n-BB0/edit?usp=sharing">How to score your hand</a></li>
            <li><a rel="noreferrer" target="_blank" href="https://docs.google.com/document/d/1oiVkcSWLIm0ZESQtXItH0EoWTAexqvhl7mrHcRQZ--M/edit?usp=sharing">Scoring quiz</a>: To practice with. Answers in comments.</li>
            <li><a rel="noreferrer" target="_blank" href="https://ooyamaneko.net/download/mahjong/riichi/Daina_Chiba_-_Riichi_Book_1_en.pdf">Riichi book</a>: A highly recommended strategy reference written in English</li>
          </ul>
        </div>
        <div className="link-list">
          <h2>Recommended Applications</h2>
          <ul>
            <li><a rel="noreferrer" target="_blank" href="https://mahjongsoul.game.yo-star.com/">Mahjong Soul</a>: A phenomenal application to play riichi mahjong online for Mobile and Browser. Can play AI, friends, and/or online people.</li>
            <li><a rel="noreferrer" target="_blank" href="https://play.google.com/store/apps/details?id=ric.ov.RiichiCalc">Riichi Calc</a>: A scoring app that's really good for Android.</li>
            <li><a rel="noreferrer" target="_blank" href="https://apps.apple.com/us/app/riichi-mahjong-hand-calculator/id1160349726">Riichi Mahjong Hand Calculator</a>: A scoring app that's okay and for Apple products.</li>
            <li><a rel="noreferrer" target="_blank" href="https://tenhou.net/4/">Tenhou</a>: An application to play riichi mahjong online like Mahjong soul. This one is more popular with hipsters.</li>
          </ul>
        </div>
        <div className="link-list">
          <h2>Recommended Products</h2>
          <ul>
            <li><a rel="noreferrer" target="_blank" href="https://www.amazon.com/dp/B003UU129U/ref=emc_b_5_t">Regular Riichi Tileset</a></li>
            <li><a rel="noreferrer" target="_blank" href="https://www.amazon.com/gp/product/B003UTX4L0/ref=ppx_yo_dt_b_search_asin_title">Conor's Black/Yellow Riichi Tileset</a></li>
            <li><a rel="noreferrer" target="_blank" href="https://www.amazon.com/gp/product/B0017KHW3A/ref=ppx_yo_dt_b_asin_title_o00_s00">Junkmat</a>: To play on.</li>
            <li><a rel="noreferrer" target="_blank" href="https://www.amazon.co.jp/-/en/AMOS-COMPASS-Mahjong-Support-Plate/dp/B085T6ZL47/ref=sr_1_2">Amos Compass</a>: To indicate seats and place tiles against.</li>
          </ul>
        </div>
      </div>
    );
  }

  function Tournaments() {
    if (Date.now() > new Date(2024, 27, 27)) {
      return (
        <div className="text-content">
          <p>Sorry no scheduled tournaments at the moment.</p>
        </div>
      );
    }
    return (
      <div className="text-content">
        <h2>3rd Annual Riichi Mahjong Tournament</h2>
        <p>
  It's that time of year again! We'll be having our Annual Club Tournament! It'll be in the same place as last year (Talison Row Apts Game Room, near mailboxes).
  <br/>
  All skill levels are welcome as long as they know how to play the game already. (Can't teach from scratch mid-tourney).
  <br/>
  We will have prizes including something particularly cool donated by our own @itsmat124!
  <br/>
  The tournament will be run a little more similar to NARMA/WRC for practice, but will still be as casual as the previous two.
  <br/>
  Food (almost certainly pizza) will be provided partway into the event. Spectators are also welcome.</p>
        <a className="btn btn-primary" rel="noreferrer" target="_blank" href="https://forms.gle/Pz8VK4G6fLYPAa8J7">Register Here</a>
      </div>
    );
  }

  async function GetMemberList(members, setMembers, setError) {
    useEffect(() => {
      if (!members || members.length === 0) {
        const func = async () => {
          const requestOptions = {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          };
          const response = await fetch(`${config.siteBaseUrl}/getmembers`, requestOptions);
          if (response.ok) {
            setMembers(await response.json());
          } else {
            setError("Failed to retrieve member list.");
          }
        };
        func();
      }
    });
  }

  async function GetUserData(userData, setUserData, callback = () => {}) {
    useEffect(() => {
      if (!userData.email) {
        const func = async () => {
          const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authentication-Session-Id': user.session_id },
            body: JSON.stringify({
              email: user.email
            })
          };
          const response = await fetch(`${config.siteBaseUrl}/getuser`, requestOptions);
          if (response.ok) {
            const userDetails = await response.json();
            setUserData(userDetails);
            callback(userDetails);
          } else {
            setUser({ session_id: undefined, sendCode: undefined });
            navigate('/login');
          }
        };
        func();
      }
    });
  }

  function Profile() {
    const [userData, setUserData] = useState({});
    const [editMode, setEditMode] = useState(false);
    const [error, setError] = useState(undefined);

    GetUserData(userData, setUserData);

    async function save() {
      const body = {
        ...userData,
        name: document.querySelector('#name').value,
        email: document.querySelector('#email').value,
        discord_username: document.querySelector('#discord').value,
        majsoul_username: document.querySelector('#majsoul').value,
      };
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authentication-Session-Id': user.session_id },
        body: JSON.stringify(body)
      };

      setError(undefined);
      const response = await fetch(`${config.siteBaseUrl}/updateuser`, requestOptions);
      if (response.ok) {
        setUserData(body);
        setEditMode(false);
      } else {
        const data = await response.json();
        setError(data.message);
      }
    }

    async function changeAvatar(image) {
      const body = {
        email: userData.email,
        avatar: image
      };
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authentication-Session-Id': user.session_id },
        body: JSON.stringify(body)
      };

      setError(undefined);
      const response = await fetch(`${config.siteBaseUrl}/updateuseravatar`, requestOptions);
      if (response.ok) {
        setUserData({ ...userData, avatar: image });
      } else {
        const data = await response.json();
        setError(data.message);
      }
    }

    return (
      <div className="profile-page">
        { error &&
          <p className="error-banner">{error}</p>
        }
        <div className="row">
          <div className="avatar-section section">
            <div className="vertical-center">
              <ProfilePic
                key={0}
                name={userData.name ?? userData.email ?? user.email}
                image={userData.avatar}
                imageUpdated={changeAvatar}
                className="avatar"
              />
              <h2>{ userData.name }</h2>
            </div>
          </div>
          { !editMode &&
            <div className="details-section section">
              <ul>
                <li><label><h6>Name</h6></label><span>{ userData.name }</span></li>
                <hr />
                <li><label><h6>Email</h6></label><span>{ userData.email?.toLowerCase() }</span></li>
                <hr />
                <li><label><h6>Discord</h6></label><span>{ userData.discord_username }</span></li>
                <hr />
                <li><label><h6>Mahjong Soul</h6></label><span>{ userData.majsoul_username }</span></li>
                <hr />
              </ul>
              <button className="btn btn-primary" onClick={() => setEditMode(true)}>Edit</button>
            </div>
          }
          { editMode &&
            <div className="details-section section">
              <ul>
                <li><label><h6>Name</h6></label><span><input id="name" defaultValue={ userData.name } /></span></li>
                <hr />
                <li><label><h6>Email</h6></label><span><input id="email" defaultValue={ userData.email?.toLowerCase() } /></span></li>
                <hr />
                <li><label><h6>Discord</h6></label><span><input id="discord" defaultValue={ userData.discord_username } /></span></li>
                <hr />
                <li><label><h6>Mahjong Soul</h6></label><span><input id="majsoul" defaultValue={ userData.majsoul_username } /></span></li>
                <hr />
              </ul>
              <div>
                <button className="btn btn-primary" onClick={save}>Save</button>
                <button style={ {'margin-left': '5px' } } className="btn btn-link" onClick={() => setEditMode(false)}>Cancel</button>
              </div>
            </div>
          }
        </div>
      </div>
    )
  }

  function ReportMatch() {
    const [userData, setUserData] = useState({});
    const [error, setError] = useState(undefined);
    const [members, setMembers] = useState([]);
    const [match, setMatch] = useState({
      player1: {
        id: userData._id?.$oid,
        score: 25000
      },
      player2: {
        id: userData._id?.$oid,
        score: 25000
      },
      player3: {
        id: userData._id?.$oid,
        score: 25000
      },
      player4: {
        id: userData._id?.$oid,
        score: 25000
      },
    });

    GetUserData(userData, setUserData, userData => {
      setMatch({
        player1: {
          id: userData._id?.$oid,
          score: 25000
        },
        player2: {
          id: userData._id?.$oid,
          score: 25000
        },
        player3: {
          id: userData._id?.$oid,
          score: 25000
        },
        player4: {
          id: userData._id?.$oid,
          score: 25000
        },
      });
    });
    GetMemberList(members, setMembers, setError);

    async function saveMatch() {
      const players = [match.player1, match.player2, match.player3, match.player4];
      if (new Set(players.map(p => p.id)).size < 4) {
        setError("Each player must be different");
      } else {
        const body = {
          players: players.map(p => ({ ...p, score: parseInt(p.score) })),
          date: new Date().toUTCString()
        };
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authentication-Session-Id': user.session_id },
          body: JSON.stringify(body)
        };

        setError(undefined);
        const response = await fetch(`${config.siteBaseUrl}/savematch`, requestOptions);
        if (!response.ok) {
          const data = await response.json();
          setError(data.message);
        }
      }
    }

    function updateMatch(newStuff) {
      const newMatch = {
        player1: {
          ...match.player1,
          ...newStuff.player1
        },
        player2: {
          ...match.player2,
          ...newStuff.player2
        },
        player3: {
          ...match.player3,
          ...newStuff.player3
        },
        player4: {
          ...match.player4,
          ...newStuff.player4
        },
      };
      setMatch(newMatch);
    }

    return (
      <div className="report-match-page">
        { error &&
          <p className="error-banner">{error}</p>
        }
        <ul>
          <li>
            <label>
              Player 1:
              <select value={match.player1.id} disabled={true}>
                <option value={userData._id?.$oid}>{userData.name ?? userData.email}</option>
              </select>
            </label>
            <label>
              Score:
              <input type="number" value={match.player1.score} onChange={e => updateMatch({player1: { score: e.target.value }})}/>
            </label>
          </li>
          <li>
            <label>
              Player 2:
              <select value={match.player2.id} onChange={e => updateMatch({player2: { id: e.target.value }})}>
                {members.map(member => <option key={0} value={member._id.$oid}>{member.name ?? member.email}</option>)}
              </select>
            </label>
            <label>
              Score:
              <input type="number" value={match.player2.score} onChange={e => updateMatch({player2: { score: e.target.value }})}/>
            </label>
          </li>
          <li>
            <label>
              Player 3:
              <select value={match.player3.id} onChange={e => updateMatch({player3: { id: e.target.value }})}>
                {members.map(member => <option key={0} value={member._id.$oid}>{member.name ?? member.email}</option>)}
              </select>
            </label>
            <label>
              Score:
              <input type="number" value={match.player3.score} onChange={e => updateMatch({player3: { score: e.target.value }})}/>
            </label>
          </li>
          <li>
            <label>
              Player 4:
              <select value={match.player4.id} onChange={e => updateMatch({player4: { id: e.target.value }})}>
                {members.map(member => <option key={0} value={member._id.$oid}>{member.name ?? member.email}</option>)}
              </select>
            </label>
            <label>
              Score:
              <input type="number" value={match.player4.score} onChange={e => updateMatch({player4: { score: e.target.value }})}/>
            </label>
          </li>
        </ul>
        <button className="btn btn-primary" onClick={saveMatch}>Submit</button>
      </div>
    );
  }

  function NoMatch() {
    return (
      <div>
        <h2>Nothing to see here!</h2>
        <p>
          <Link to="/">Go to the home page</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="events" element={<Events />} />
          <Route path="resources" element={<Resources />} />
          <Route path="tournaments" element={<Tournaments />} />
          <Route path="login" element={<Login />} />
          <Route path="profile" element={<Profile />} />
          <Route path="report_match" element={<ReportMatch />} />

          <Route path="*" element={<NoMatch />} />
        </Route>
      </Routes>
    </div>
  );
}