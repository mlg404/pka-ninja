import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MarketProvider } from "./lib/market";
import { BoostPage } from "./pages/BoostPage";
import { EconomyPage } from "./pages/EconomyPage";
import { ItemDetailPage } from "./pages/ItemDetailPage";
import { ItemsPage } from "./pages/ItemsPage";
import { ListingsPage } from "./pages/ListingsPage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";
import { PokemonPage } from "./pages/PokemonPage";

export function App() {
  return (
    <MarketProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<EconomyPage />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/items/:name" element={<ItemDetailPage />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/oportunidades" element={<OpportunitiesPage />} />
            <Route path="/pokemon" element={<PokemonPage />} />
            <Route path="/boost" element={<BoostPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MarketProvider>
  );
}
