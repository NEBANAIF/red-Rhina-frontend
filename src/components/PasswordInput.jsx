import React, { useState } from 'react';
import Icon from './Icon.jsx';

/** Password field with a show/hide (eye) button so people can see what they type. */
export default function PasswordInput({ className = 'input', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-10`} />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-500 hover:text-ink-900"
        title={show ? 'Hide password' : 'Show password'} aria-label={show ? 'Hide password' : 'Show password'}>
        <Icon name={show ? 'eye-off' : 'eye'} size={16} />
      </button>
    </div>
  );
}
