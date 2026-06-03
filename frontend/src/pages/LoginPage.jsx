import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../layouts/Layout";
import { loginUser } from "../services/api";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await loginUser({ email, password });

      localStorage.setItem("readora_token", data.token);
      localStorage.setItem("readora_user", JSON.stringify(data.user));
      navigate("/");
    } catch (authError) {
      setError(authError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <section className="auth-section">
        <div className="container auth-container">
          <form className="auth-card" onSubmit={handleSubmit}>
            <p className="eyebrow">Tài khoản</p>
            <h1>Đăng nhập</h1>

            {error && (
              <p className="auth-card__error" role="alert">
                {error}
              </p>
            )}

            <label className="form-group">
              Email
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="form-group">
              Mật khẩu
              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                required
              />
            </label>

            <button
              type="submit"
              className="button button--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <p className="auth-card__switch">
              Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
            </p>
          </form>
        </div>
      </section>
    </Layout>
  );
}

export default LoginPage;
