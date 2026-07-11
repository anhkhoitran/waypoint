import { Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { InsightsPage } from './pages/InsightsPage';
import { RadarPage } from './pages/RadarPage';
import { ReviewPage } from './pages/ReviewPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { TrackerPage } from './pages/TrackerPage';

export function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main">
        <div className="main-inner">
          <Routes>
            <Route path="/" element={<RadarPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/tracker" element={<TrackerPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
