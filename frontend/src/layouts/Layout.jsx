import Footer from "../components/Footer";
import Header from "../components/Header";

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Header />
      <main className="main-content">{children}</main>
      <Footer />
    </div>
  );
}

export default Layout;
