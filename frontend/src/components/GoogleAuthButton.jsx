import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

function GoogleAuthButton({ onSuccess, onError, disabled = false }) {
  const buttonRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!GOOGLE_CLIENT_ID) {
      return undefined;
    }

    loadGoogleScript()
      .then(() => {
        if (!isMounted || !buttonRef.current) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response?.credential) {
              onSuccess(response.credential);
              return;
            }

            onError(new Error("Không nhận được Google ID token."));
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: buttonRef.current.offsetWidth || 320,
          text: "continue_with",
          locale: "vi",
        });
        setIsReady(true);
      })
      .catch(() => {
        if (isMounted) {
          onError(new Error("Không thể tải Google đăng nhập."));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [onError, onSuccess]);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  return (
    <div className="google-auth">
      <div
        ref={buttonRef}
        className={disabled || !isReady ? "google-auth__button is-disabled" : "google-auth__button"}
        aria-label="Tiếp tục với Google"
      />
    </div>
  );
}

export default GoogleAuthButton;
