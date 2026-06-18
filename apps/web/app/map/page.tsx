import { redirect } from 'next/navigation';

/** Legacy /map path — home is the map view. */
export default function MapPage() {
  redirect('/');
}