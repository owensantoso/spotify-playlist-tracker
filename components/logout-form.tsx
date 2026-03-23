export function LogoutForm() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm text-stone-200 transition hover:border-white/30 hover:text-white"
      >
        Log out
      </button>
    </form>
  );
}
