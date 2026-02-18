import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoDetailShell } from "@/components/photo-detail-shell";
import { getPhotoBySlug } from "@/lib/photos";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    return {
      title: "Photo Not Found",
    };
  }

  return {
    title: `${photo.title} | Photo Blog`,
    description: photo.caption,
    openGraph: {
      title: photo.title,
      description: photo.caption,
      images: [photo.src],
    },
  };
}

export default async function PhotoDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    notFound();
  }

  return <PhotoDetailShell photo={photo} />;
}
