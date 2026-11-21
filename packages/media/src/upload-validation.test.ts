import { describe, expect, it } from "vitest";

import {
  ImageUploadValidationError,
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageUpload,
} from "./upload-validation";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGOUi1rAwMDAxMDAwMDAAAAMyAEcmM2rsQAAAABJRU5ErkJggg==",
  "base64",
);
// A real 1x1 RGB JPEG fixture, rather than a fabricated 3-byte prefix.
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCVAHVmf//Z",
  "base64",
);

describe("validateImageUpload", () => {
  it("accepts genuine PNG and JPEG fixtures", () => {
    expect(
      validateImageUpload({ filename: "product.png", contentType: "image/png", bytes: png }),
    ).toMatchObject({ mimeType: "image/png", extension: "png", originalFilename: "product.png" });
    expect(
      validateImageUpload({ filename: "headshot.JPEG", contentType: "image/jpeg", bytes: jpeg }),
    ).toMatchObject({ mimeType: "image/jpeg", extension: "jpg" });
  });

  it("rejects empty and oversized images", () => {
    expect(() =>
      validateImageUpload({ filename: "a.png", contentType: "image/png", bytes: new Uint8Array() }),
    ).toThrow(ImageUploadValidationError);
    expect(() =>
      validateImageUpload({
        filename: "a.png",
        contentType: "image/png",
        bytes: new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1),
      }),
    ).toThrow("15 MB");
  });

  it("rejects forged or incomplete signatures and mismatched MIME types", () => {
    for (const bytes of [Buffer.from("not an image"), png.subarray(0, 8), jpeg.subarray(0, 4)]) {
      expect(() =>
        validateImageUpload({ filename: "a.png", contentType: "image/png", bytes }),
      ).toThrow("Invalid PNG/JPEG signature");
    }
    expect(() =>
      validateImageUpload({ filename: "fake.jpg", contentType: "image/jpeg", bytes: png }),
    ).toThrow();
    expect(() =>
      validateImageUpload({ filename: "fake.png", contentType: "image/jpeg", bytes: png }),
    ).toThrow();
    expect(() =>
      validateImageUpload({ filename: "fake.gif", contentType: "image/gif", bytes: png }),
    ).toThrow();
  });

  it("rejects unsafe filenames", () => {
    const filenames = [
      "../a.png",
      "..a.png",
      "a/b.png",
      "a\\b.png",
      ".hidden.png",
      "a.png.",
      "CON.jpg",
      "bad name.png",
      "x\u0000.png",
    ];
    for (const filename of filenames) {
      expect(() =>
        validateImageUpload({ filename, contentType: "image/png", bytes: png }),
      ).toThrow("Unsafe image filename");
    }
  });

  it("rejects an extension that does not agree with the image bytes", () => {
    expect(() =>
      validateImageUpload({ filename: "good.jpg", contentType: "image/jpeg", bytes: png }),
    ).toThrow();
  });
});
