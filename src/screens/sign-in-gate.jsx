// =====================================================================
// src/screens/sign-in-gate.jsx — generic "sign in to use this" gate (A1 slice 18)
// Extracted from App.jsx. Body byte-identical; only change is the A7 hook
// line (T -> useTheme). Props stay { icon, title, body, onSignIn, onBack }.
// =====================================================================
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';
import { Button, TopBar } from '../ui/primitives.jsx';

function SignInGate({ icon, title, body, onSignIn, onBack }) {
  const { theme: T } = useTheme();
  return (
    <div className="anim-fadeup">
      <TopBar title={title} onBack={onBack} />
      <div className="max-w-md mx-auto px-4 pt-10 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
             style={{ background: T.primary + '14' }}>
          {icon}
        </div>
        <div className="font-display text-xl font-semibold mb-2" style={{ color: T.ink }}>{title}</div>
        <div className="text-sm leading-relaxed mb-6" style={{ color: T.inkSoft }}>{body}</div>
        <Button onClick={onSignIn} className="w-full">Sign in / Create account</Button>
        <button onClick={onBack}
                className="no-tap-highlight mt-3 text-sm font-medium"
                style={{ color: T.muted }}>
          Keep exploring as guest
        </button>
      </div>
    </div>
  );
}

export default SignInGate;
