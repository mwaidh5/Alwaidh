import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { recordPageView } from './lib/analyticsStore';
import { logPageView } from './firebase';
import Layout from './components/Layout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import SolarPrices from './pages/SolarPrices';
import About from './pages/About';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Overview from './pages/admin/Overview';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSubmissions from './pages/admin/AdminSubmissions';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSolarPrices from './pages/admin/AdminSolarPrices';
import AdminMedia from './pages/admin/AdminMedia';
import AdminJobs from './pages/admin/AdminJobs';
import NotFound from './pages/NotFound';

export default function App() {
  const location = useLocation();

  // Record each page view for in-app analytics and Google Analytics.
  useEffect(() => {
    const path = location.pathname + location.search;
    recordPageView(path);
    logPageView(path);
  }, [location.pathname]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/solar-prices" element={<SolarPrices />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />}>
          <Route index element={<Overview />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="submissions" element={<AdminSubmissions />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="prices" element={<AdminSolarPrices />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="media" element={<AdminMedia />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
