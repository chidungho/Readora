import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();

    let script = document.getElementById(GOOGLE_SCRIPT_ID);

    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.onload = resolve;
    script.onerror = reject;
  });

function GoogleAuthButton({ onSuccess, onError, disabled = false }) {
  const buttonRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!GOOGLE_CLIENT_ID) {
      onError?.(new Error("Thiếu VITE_GOOGLE_CLIENT_ID."));
      return;
    }

    loadGoogleScript()
      .then(() => {
        if (!mounted || !buttonRef.current) return;

        buttonRef.current.innerHTML = "";

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response?.credential) {
              onSuccess(response.credential);
            } else {
              onError(new Error("Không nhận được Google ID token."));
            }
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: 360,
          text: "continue_with",
          locale: "vi",
        });

        setIsReady(true);
      })
      .catch(() => {
        onError(new Error("Không thể tải Google đăng nhập."));
      });

    return () => {
      mounted = false;
      if (buttonRef.current) buttonRef.current.innerHTML = "";
    };
  }, [onError, onSuccess]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="google-auth">
      <div
        ref={buttonRef}
        className="google-auth__button"
        style={{
          opacity: disabled || !isReady ? 0.6 : 1,
          pointerEvents: disabled || !isReady ? "none" : "auto",
        }}
      />
    </div>
  );
}

export default GoogleAuthButton;