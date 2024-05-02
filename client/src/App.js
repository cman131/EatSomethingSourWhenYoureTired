import { Routes, Route, Outlet, Link } from "react-router-dom";
import './App.css';

export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="events" element={<Events />} />

          <Route path="*" element={<NoMatch />} />
        </Route>
      </Routes>
    </div>
  );
}

function Layout() {
  return (
    <div>
      <nav>
        <ul>
          <li>
            <Link to="/">
              <img alt="CHS Riichi Club Logo" src="./logo_alpha.png" />
              <h1>Charleston Riichi Mahjong</h1>
            </Link>
          </li>
          <li>
            <Link to="/events">Events</Link>
          </li>
          <li>
            <a rel="noreferrer" target="_blank" href="https://www.meetup.com/charleston-riichi-mahjong/">Meetup</a>
          </li>
        </ul>
      </nav>

      <Outlet />
    </div>
  );
}

function Home() {
  return (
    <div class="text-content">
      <p>
        Welcome to Charleston's Riichi Mahjong Club!
        <br />
        We primarily play 10am - 12pm every Sunday at Mercantile and Mash downtown.
        <br />
        All skill levels are welcome and we're happy to run teaching games too! Join us sometime, it's super fun!
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