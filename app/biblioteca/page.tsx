import { Suspense } from "react";
import { Library } from "@/components/library";
import { getAllBests } from "@/lib/scores";

// El mejor global sale de la BD (siempre dinámico): mientras llega se muestra "···".
export default function BibliotecaPage() {
  return (
    <Suspense fallback={<Library />}>
      <LibraryWithBests />
    </Suspense>
  );
}

async function LibraryWithBests() {
  const bests = await getAllBests();
  return <Library bests={bests} />;
}
