"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { BlobImage } from "@/components/visual/StoredImage";
import { deleteMediaAsset, getMediaAsset, saveMediaAsset, type MediaAsset } from "@/lib/mediaStorage";
import { MAX_CHARACTER_REFERENCES, MAX_REFERENCE_SOURCE_BYTES } from "@/lib/characterReferenceLimits";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type Props = {
  projectId: string;
  characterId: string;
  referenceAssetIds: string[];
  onChange: (ids: string[]) => void;
};

function ReferencePreview({ assetId, projectId, characterId, index }: {
  assetId: string; projectId: string; characterId: string; index: number;
}) {
  const [asset, setAsset] = useState<MediaAsset | null | undefined>();

  useEffect(() => {
    let active = true;
    getMediaAsset(assetId).then((found) => {
      if (active) setAsset(found?.projectId === projectId && found.ownerId === characterId && found.ownerType === "character-reference" ? found : null);
    }).catch(() => { if (active) setAsset(null); });
    return () => { active = false; };
  }, [assetId, projectId, characterId]);

  if (asset === undefined) return <span className="text-[10px] text-[#7A7067]">불러오는 중</span>;
  if (!asset) return <span className="px-2 text-center text-[10px] text-orange-700">원본 이미지 없음</span>;
  return <BlobImage blob={asset.blob} alt={`캐릭터 참고 이미지 ${index + 1}`} className="h-full w-full object-contain" />;
}

async function checkImage(file: File): Promise<void> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("PNG, JPG, WebP 이미지만 추가할 수 있어요.");
  if (file.size === 0) throw new Error("비어 있는 이미지 파일은 추가할 수 없어요.");
  if (file.size > MAX_REFERENCE_SOURCE_BYTES) throw new Error("참고 이미지 한 장은 10 MiB 이하여야 해요. 크기를 줄여 다시 선택해 주세요.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validSignature = file.type === "image/png"
    ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    : file.type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!validSignature) throw new Error("파일 형식과 실제 이미지 내용이 달라요. PNG, JPG, WebP 파일을 다시 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("이미지 크기를 확인할 수 없어요.");
  } catch {
    throw new Error("이미지 파일을 열 수 없어요. 다른 PNG, JPG, WebP 파일을 선택해 주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function CharacterReferences({ projectId, characterId, referenceAssetIds, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const idsRef = useRef(referenceAssetIds);

  useEffect(() => { idsRef.current = referenceAssetIds; }, [referenceAssetIds]);

  const removeOldAsset = async (assetId: string) => {
    const asset = await getMediaAsset(assetId);
    if (asset?.projectId === projectId && asset.ownerId === characterId && asset.ownerType === "character-reference") {
      await deleteMediaAsset(assetId);
    }
  };

  const selectFile = async (file: File | undefined, replaceIndex?: number) => {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    let newAssetId: string | undefined;
    try {
      const currentIds = idsRef.current;
      if (replaceIndex === undefined && currentIds.length >= MAX_CHARACTER_REFERENCES) {
        throw new Error("캐릭터당 참고 이미지는 최대 3장까지 추가할 수 있어요.");
      }
      if (replaceIndex !== undefined && !currentIds[replaceIndex]) {
        throw new Error("교체할 참고 이미지를 찾지 못했어요.");
      }
      await checkImage(file);
      const asset = await saveMediaAsset({
        projectId, ownerId: characterId, ownerType: "character-reference", mimeType: file.type, blob: file,
      });
      newAssetId = asset.id;
      const oldId = replaceIndex === undefined ? undefined : currentIds[replaceIndex];
      const nextIds = replaceIndex === undefined
        ? [...currentIds, asset.id]
        : currentIds.map((id, index) => index === replaceIndex ? asset.id : id);
      onChange(nextIds);
      idsRef.current = nextIds;
      newAssetId = undefined;
      if (oldId) await removeOldAsset(oldId);
    } catch (cause) {
      if (newAssetId) await deleteMediaAsset(newAssetId).catch(() => {});
      setError(cause instanceof Error ? cause.message : "참고 이미지를 저장하지 못했어요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const remove = async (index: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const currentIds = idsRef.current;
      const oldId = currentIds[index];
      if (!oldId) return;
      const nextIds = currentIds.filter((_, itemIndex) => itemIndex !== index);
      onChange(nextIds);
      idsRef.current = nextIds;
      await removeOldAsset(oldId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "참고 이미지를 삭제하지 못했어요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-label="캐릭터 참고 이미지" aria-busy={busy} className="mb-3 rounded-xl border border-[#E4DDF8] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-[#1A1A1A]">캐릭터 참고 이미지 · {referenceAssetIds.length}/{MAX_CHARACTER_REFERENCES}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#7A7067]">손그림이나 다른 앱의 PNG, JPG, WebP 이미지를 한 장당 10 MiB까지 보관할 수 있어요.</p>
        </div>
        {referenceAssetIds.length < MAX_CHARACTER_REFERENCES && (
          <label className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#C4B5FD] px-3 text-[11px] font-semibold text-[#6D28D9] ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#F5F3FF]"}`}>
            {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            이미지 추가
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" aria-label="캐릭터 참고 이미지 추가" onChange={(event) => {
              void selectFile(event.target.files?.[0]);
              event.target.value = "";
            }} />
          </label>
        )}
      </div>
      {referenceAssetIds.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {referenceAssetIds.map((assetId, index) => (
            <div key={assetId} className="min-w-0 rounded-lg border border-[#E4DDF8] bg-[#FAF8FF] p-2">
              <div className="flex h-28 items-center justify-center overflow-hidden rounded-md bg-white">
                <ReferencePreview assetId={assetId} projectId={projectId} characterId={characterId} index={index} />
              </div>
              <p className="mt-1.5 text-[10px] font-medium text-[#5B5560]">참고 이미지 {index + 1}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <label className={`inline-flex min-h-9 items-center rounded-md border border-[#E4DDF8] bg-white px-2.5 text-[10px] ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#F5F3FF]"}`}>
                  교체
                  <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" aria-label={`참고 이미지 ${index + 1} 교체`} onChange={(event) => {
                    void selectFile(event.target.files?.[0], index);
                    event.target.value = "";
                  }} />
                </label>
                <button type="button" disabled={busy} onClick={() => void remove(index)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#E4DDF8] bg-white px-2.5 text-[10px] hover:bg-red-50 disabled:opacity-60" aria-label={`참고 이미지 ${index + 1} 삭제`}>
                  <Trash2 className="h-3 w-3" /> 삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-[#7A7067]">시트 생성 시 이미지 사본을 각 900 kB 이하로 줄여 AI에 전달합니다. 텍스트 설정이 우선이며, 후보를 확인한 뒤 적용해 주세요. 원본은 이 브라우저에 저장되고 JSON 백업에는 포함되지 않습니다.</p>
      {error && <p role="alert" className="mt-2 text-[11px] text-red-700">{error}</p>}
    </section>
  );
}
