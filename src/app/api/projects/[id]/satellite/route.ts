import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api';
import { isPlaceholderCoords } from '@/lib/location';
import { getSiteImage, SatelliteUnavailableError } from '@/lib/satellite';
import { releaseFor, type SatelliteWhen } from '@/lib/satellite-releases';

/**
 * GET /api/projects/[id]/satellite?when=start|latest
 * → image/jpeg (768 px, centred on the project with a marker)
 * → 404 when the project has no real coordinates or imagery can't be fetched.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const when: SatelliteWhen = request.nextUrl.searchParams.get('when') === 'start' ? 'start' : 'latest';

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { gpsLat: true, gpsLng: true, startDate: true },
    });
    if (!project) return jsonError(404, 'Project not found.');
    if (isPlaceholderCoords(project.gpsLat, project.gpsLng)) {
      return jsonError(404, 'This project has no confirmed location, so there is no satellite photo.');
    }

    const release = releaseFor(when, project.startDate);
    const image = await getSiteImage(project.gpsLat, project.gpsLng, release);

    return new Response(new Uint8Array(image.jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Imagery-Release': release.name,
        'X-Imagery-Year': String(release.year),
        'X-Imagery-Photo-Id': image.photoId,
      },
    });
  } catch (err) {
    if (!(err instanceof SatelliteUnavailableError)) console.warn(`[satellite ${id}] image failed:`, err);
    return jsonError(404, 'We could not load a satellite photo for this spot right now.');
  }
}
