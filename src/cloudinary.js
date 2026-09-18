// Upload de mídia local para o Cloudinary. Devolve uma URL https pública e permanente.
// Configuração via CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
import { v2 as cloudinary } from "cloudinary";
import { basename, extname } from "node:path";

export async function uploadMedia(filePath, { folder = "buffer" } = {}) {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error("CLOUDINARY_URL não definida. Pegue em https://console.cloudinary.com > Settings > API Keys.");
  }
  cloudinary.config({ secure: true });

  const publicId = basename(filePath, extname(filePath)).replace(/[^\w-]+/g, "_");
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    public_id: publicId,
    resource_type: "auto",     // detecta image ou video
    overwrite: true,
    use_filename: false,
    chunk_size: 20 * 1024 * 1024, // vídeos grandes em partes de 20 MB
  });

  return {
    url: result.secure_url,               // https, público, sem expiração
    kind: result.resource_type,           // "image" | "video"
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    duration: result.duration ?? null,    // só vídeo
  };
}
