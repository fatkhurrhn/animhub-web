// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/BottomNav';
import HomePage from './pages/HomePage';
import AutoToTop from './components/AutoToTop';
import Search from './pages/SearchPage';
import WatchPage from './pages/WatchPage';
import DetailPage from './pages/DetailPage';
import ExplorePage from './pages/ExplorePage';
import Tess from './pages/Tess';

function App() {
  return (
    <>
      <AutoToTop />
      <Routes>
        {/* Routes without bottom navigation (full screen) - LETAKKAN DI ATAS */}

        <Route path="/detail/:type/:slug" element={<DetailPage />} />

        <Route path="/watch/:type/:slug" element={<WatchPage />} />

        {/* <Tess slug="jingai-kyoushitsu-no-ningengirai-kyoushi-episode-5-subtitle-indonesia" type="anime" />
        <Tess slug="the-daily-life-of-the-immortal-king-episode-13-subtitle-indonesia" type="donghua" /> */}


        {/* <Route path="/watch/:type/:slug" element={<Tess />} /> */}

        {/* Routes with bottom navigation */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/explore/:tab" element={<ExplorePage />} />


          <Route path="/search" element={<Search />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;