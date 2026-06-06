import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GoogleAuthButton from "../components/GoogleAuthButton";
import Layout from "../layouts/Layout";
import { registerUser, loginWithGoogle } from "../services/api";

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const persistAuth = useCallback((data) => {
    localStorage.setItem("readora_token", data.token);
    localStorage.setItem("readora_user", JSON.stringify(data.user));
    navigate("/");
  }, [navigate]);

  const handleGoogleSuccess = useCallback(async (idToken) => {
    setError("");
    setIsSubmitting(true);

    try {
      const data = await loginWithGoogle(idToken);
      persistAuth(data);
    } catch (authError) {
      setError(authError.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [persistAuth]);

  const handleGoogleError = useCallback((authError) => {
    setError(authError.message);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await registerUser({ name, email, password });

      persistAuth(data);
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
            <p className="eyebrow">Tài khoản mới</p>
            <h1>Đăng ký</h1>

            {error && (
              <p className="auth-card__error" role="alert">
                {error}
              </p>
            )}

            <label className="form-group">
              Họ tên
              <input
                type="text"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nguyễn Văn A"
                autoComplete="name"
                required
              />
            </label>

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
                placeholder="Tạo mật khẩu"
                autoComplete="new-password"
                required
              />
            </label>

            <button
              type="submit"
              className="button button--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang đăng ký..." : "Đăng ký"}
            </button>

            <div className="auth-card__divider">hoặc</div>

            <GoogleAuthButton
              disabled={isSubmitting}
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
            />

            <p className="auth-card__switch">
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </form>
        </div>
      </section>
    </Layout>
  );
}

export default RegisterPage;
