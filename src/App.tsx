import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Category from './pages/Category';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/category/:slug" element={<Category />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
