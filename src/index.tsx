import React, { useEffect, useState, useRef } from "react";

const global = globalThis ?? window;
let turnstileState =
  typeof (global as any).turnstile !== "undefined" ? "ready" : "unloaded";
let ensureTurnstile: () => Promise<any>;

// Functions responsible for loading the turnstile api, while also making sure
// to only load it once
{
  const TURNSTILE_LOAD_FUNCTION = "cf__reactTurnstileOnLoad";
  const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

  let turnstileLoad: {
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
  };
  const turnstileLoadPromise = new Promise((resolve, reject) => {
    turnstileLoad = { resolve, reject };
    if (turnstileState === "ready") resolve(undefined);
  });
  (global as any)[TURNSTILE_LOAD_FUNCTION] = () => {
    turnstileLoad.resolve();
    turnstileState = "ready";
  };

  ensureTurnstile = () => {
    if (turnstileState === "unloaded") {
      turnstileState = "loading";
      const url = `${TURNSTILE_SRC}?onload=${TURNSTILE_LOAD_FUNCTION}&render=explicit`;
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.addEventListener("error", () => {
        turnstileLoad.reject("Failed to load Turnstile.");
      });
      document.head.appendChild(script);
    }
    return turnstileLoadPromise;
  };
}

export default function Turnstile({
  id,
  className,
  style,
  sitekey,
  action,
  cData,
  theme,
  tabIndex,
  responseField,
  responseFieldName,
  onVerify,
  onLoad,
  onError,
  onExpire,
}: TurnstileProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inplaceState = useState<TurnstileCallbacks>({ onVerify })[0];

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    let widgetId = "";
    (async () => {
      // load turnstile
      if (turnstileState !== "ready") {
        try {
          await ensureTurnstile();
        } catch (e) {
          inplaceState.onError?.(e);
          return;
        }
      }
      if (cancelled || !ref.current) return;
      const turnstileOptions: TurnstileOptions = {
        sitekey,
        action,
        cData,
        theme,
        tabindex: tabIndex,
        callback: (token: string) => inplaceState.onVerify(token),
        "error-callback": () => inplaceState.onError?.(),
        "expired-callback": () => inplaceState.onExpire?.(),
        "response-field": responseField,
        "response-field-name": responseFieldName,
      };

      widgetId = window.turnstile.render(ref.current, turnstileOptions);
      inplaceState.onLoad?.(widgetId);
    })();
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile.remove(widgetId);
    };
  }, [
    sitekey,
    action,
    cData,
    theme,
    tabIndex,
    responseField,
    responseFieldName,
  ]);
  useEffect(() => {
    inplaceState.onVerify = onVerify;
    inplaceState.onLoad = onLoad;
    inplaceState.onError = onError;
    inplaceState.onExpire = onExpire;
  }, [onVerify, onLoad, onError, onExpire]);

  return <div ref={ref} id={id} className={className} style={style} />;
}

interface TurnstileProps extends TurnstileCallbacks {
  sitekey: string;
  action?: string;
  cData?: string;
  theme?: "light" | "dark" | "auto";
  tabIndex?: number;
  responseField?: boolean;
  responseFieldName?: string;

  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface TurnstileCallbacks {
  onVerify: (token: string) => void;
  onLoad?: (widgetId: string) => void;
  onError?: (error?: Error | any) => void;
  onExpire?: () => void;
}

// Generic typescript definitions of the turnstile api
// Last updated: 2022-10-02 21:30:00 UTC

declare global {
  interface Window {
    turnstile: {
      render: (
        idOrContainer: string | HTMLElement,
        options: TurnstileOptions
      ) => string;
      reset: (widgetIdOrContainer: string | HTMLElement) => void;
      getResponse: (
        widgetIdOrContainer: string | HTMLElement
      ) => string | undefined;
      remove: (widgetIdOrContainer: string | HTMLElement) => void;
    };
  }
}

interface TurnstileOptions {
  sitekey: string;
  action?: string;
  cData?: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  tabindex?: number;
  // undocumented fields
  size?: "normal" | "invisible" | "compact"; // UNUSED; compact warns that its unavailable
  "response-field"?: boolean; // defaults to true
  "response-field-name"?: string; // defaults to cf-turnstile-response
}

// query arguments when adding the script

// compat=recaptcha      registers the turnstile api as window.grecaptcha and enables recaptcha compat
// onload=x              function is executed when turnstile is loaded
// render=explicit       if this value is anything but 'explicit', the DOM is searched for implicit widgets
