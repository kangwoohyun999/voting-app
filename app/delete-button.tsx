"use client";

export function DeleteButton({ label, confirmText }: { label: string; confirmText: string }) {
  return (
    <button
      name="intent"
      value="delete"
      className="btn-secondary ml-auto text-red-600"
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
