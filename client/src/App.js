import { Routes, Route, Outlet, Link, useLocation } from "react-router-dom";
import './App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExternalLink, faBars, faArrowLeft } from '@fortawesome/free-solid-svg-icons'

export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="events" element={<Events />} />
          <Route path="resources" element={<Resources />} />
          <Route path="tournaments" element={<Tournaments />} />

          <Route path="*" element={<NoMatch />} />
        </Route>
      </Routes>
    </div>
  );
}

function Layout() {
  const { pathname } = useLocation();
  return (
    <div>
      <nav>
        <ul>
          <li class={pathname === "/" ? "current" : ""}>
            <Link title="Home" to="/">
              <img alt="CHS Riichi Club Logo" src="./logo_alpha.png" />
              <h1>Charleston Riichi Mahjong</h1>
            </Link>
          </li>
          <li class={pathname === "/events" ? "current" : ""}>
            <Link title="Events" to="/events">Events</Link>
          </li>
          <li class={pathname === "/tournaments" ? "current" : ""}>
            <Link title="Tournaments" to="/tournaments">Tournaments</Link>
          </li>
          <li class={pathname === "/resources" ? "current" : ""}>
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
          <li class="mobile menu-btn">
            <button class="btn secondary-btn" onClick={toggleMobileNavigation}><FontAwesomeIcon icon={faBars} /></button>
          </li>
        </ul>
      </nav>
      <div class="mobile mobile-nav-menu hidden">
        <button class="btn secondary-btn back-btn" onClick={toggleMobileNavigation}><FontAwesomeIcon icon={faArrowLeft} /></button>
        <ul onClick={toggleMobileNavigation}>
          <li class={pathname === "/" ? "current" : ""}>
            <Link title="Home" to="/">Home</Link>
          </li>
          <li class={pathname === "/events" ? "current" : ""}>
            <Link title="Events" to="/events">Events</Link>
          </li>
          <li class={pathname === "/tournaments" ? "current" : ""}>
            <Link title="Tournaments" to="/tournaments">Tournaments</Link>
          </li>
          <li class={pathname === "/resources" ? "current" : ""}>
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
    <div class="text-content">
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
    <div class="event-pane">
      <iframe src='https://widgets.sociablekit.com/meetup-group-events/iframe/25406359' frameborder='0' width='100%' height='100%' title="Upcoming events"></iframe>
    </div>
  );
}

function Resources() {
  return (
    <div>
      <div class="link-list">
        <h2>Learning Resources</h2>
        <ul>
          <li><a rel="noreferrer" target="_blank" href="https://docs.google.com/document/d/1vtuRiT5a6QBx7ggaOQ5P4SlnySxssZxbX6uZeHKYzOI/edit?usp=sharing">Yaku Reference Book</a></li>
          <li><a rel="noreferrer" target="_blank" href="https://docs.google.com/document/d/1Cai2O3TsZyv3nV-gXU46I6taYoDFjlutNiOxS2n-BB0/edit?usp=sharing">How to score your hand</a></li>
          <li><a rel="noreferrer" target="_blank" href="https://docs.google.com/document/d/1oiVkcSWLIm0ZESQtXItH0EoWTAexqvhl7mrHcRQZ--M/edit?usp=sharing">Scoring quiz</a>: To practice with. Answers in comments.</li>
          <li><a rel="noreferrer" target="_blank" href="https://ooyamaneko.net/download/mahjong/riichi/Daina_Chiba_-_Riichi_Book_1_en.pdf">Riichi book</a>: A highly recommended strategy reference written in English</li>
        </ul>
      </div>
      <div class="link-list">
        <h2>Recommended Applications</h2>
        <ul>
          <li><a rel="noreferrer" target="_blank" href="https://mahjongsoul.game.yo-star.com/">Mahjong Soul</a>: A phenomenal application to play riichi mahjong online for Mobile and Browser. Can play AI, friends, and/or online people.</li>
          <li><a rel="noreferrer" target="_blank" href="https://play.google.com/store/apps/details?id=ric.ov.RiichiCalc">Riichi Calc</a>: A scoring app that's really good for Android.</li>
          <li><a rel="noreferrer" target="_blank" href="https://apps.apple.com/us/app/riichi-mahjong-hand-calculator/id1160349726">Riichi Mahjong Hand Calculator</a>: A scoring app that's okay and for Apple products.</li>
          <li><a rel="noreferrer" target="_blank" href="https://tenhou.net/4/">Tenhou</a>: An application to play riichi mahjong online like Mahjong soul. This one is more popular with hipsters.</li>
        </ul>
      </div>
      <div class="link-list">
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
      <div class="text-content">
        <p>Sorry no scheduled tournaments at the moment.</p>
      </div>
    );
  }
  return (
    <div class="text-content">
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
      <a class="btn btn-primary" rel="noreferrer" target="_blank" href="https://forms.gle/Pz8VK4G6fLYPAa8J7">Register Here</a>
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