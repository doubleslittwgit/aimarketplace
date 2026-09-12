import Header from "@/components/Header";
import BrowseClient from "./BrowseClient";

export default function BrowsePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <BrowseClient />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-10 text-[13px] text-text-dim">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-text-muted">forge.</span>
            <div className="flex gap-6">
              <a href="#" className="hover:text-text-secondary">利用規約</a>
              <a href="#" className="hover:text-text-secondary">プライバシーポリシー</a>
              <a href="#" className="hover:text-text-secondary">お問い合わせ</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
