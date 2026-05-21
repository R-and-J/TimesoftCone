import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import IndexPage from "@/pages/Index";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import AuctionListGridPage from "@/pages/AuctionListGrid";
import AuctionListRowPage from "@/pages/AuctionListRow";
import AuctionListTimelinePage from "@/pages/AuctionListTimeline";
import AuctionDetailPage from "@/pages/AuctionDetail";
import BidInteractionsPage from "@/pages/BidInteractions";
import MyActivityPage from "@/pages/MyActivity";
import DividendPage from "@/pages/Dividend";
import AdminOpsPage from "@/pages/AdminOps";
import AdminLedgerPage from "@/pages/AdminLedger";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Entry — real app flow always starts at login. */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/auction" element={<AuctionListGridPage />} />
        <Route path="/auction/row" element={<AuctionListRowPage />} />
        <Route path="/auction/timeline" element={<AuctionListTimelinePage />} />
        <Route path="/auction/detail" element={<AuctionDetailPage />} />
        <Route path="/auction/detail/:id" element={<AuctionDetailPage />} />
        <Route path="/auction/bid-variants" element={<BidInteractionsPage />} />
        <Route path="/activity" element={<MyActivityPage />} />
        <Route path="/dividend" element={<DividendPage />} />
        <Route path="/admin/ops" element={<AdminOpsPage />} />
        <Route path="/admin/ledger" element={<AdminLedgerPage />} />

        {/* Developer escape hatch — full 12-screen catalog. Not linked from
            normal user flow; reach via /_screens or the link in Login footer. */}
        <Route path="/_screens" element={<IndexPage />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
