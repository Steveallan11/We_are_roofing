"use client";

export function PhotoUploadButton({ jobId }: { jobId: string }) {
  return (
    <label className="button-secondary text-sm cursor-pointer">
      Upload Photos
      <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={async (e) => {
        const files = e.target.files;
        if (!files?.length) return;
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("photo_type", "General");
          await fetch("/api/jobs/" + jobId + "/photos", { method: "POST", body: fd });
        }
        window.location.reload();
      }} />
    </label>
  );
}
