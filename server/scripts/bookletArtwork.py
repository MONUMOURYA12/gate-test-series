"""Render booklet artwork without identified publisher logos and QR badges.

This is presentation cleanup, not a determination of publication rights. Keep
source attribution and licence records. Never remove arbitrary pale images:
those can be circuit diagrams, graph shading or mathematical illustrations.
"""

import hashlib
import json
from pathlib import Path

import pypdfium2 as pdfium


# Raw PDF image streams, visually verified against the supplied booklets.
# The logo occurs as a single image or two/four horizontal strips. The Signals
# booklet embeds several re-encoded variants of the same artwork.
PUBLISHER_LOGO_SHA256 = frozenset({
    "9272d2eaaaeaf33726777722dc67c2087b3c5962dbe4c5a3deab14c088a1fe2a",
    "8c4a20f795ea7e9079697acf37fb143bf18d02367f3e380089545dd67fd5ba3d",
    "63c8e419f8825c9ec8f978e5af800aac59ce89ae6e489b83e71ccf26c869f246",
    "fce1e10c0eebcf3720f14adb698c2a571223ed224e4d760bb764b52621d60e8c",
    "f9878d2bf8dcc16fd6dd86268f68f59fa182799d2bd2599d1fa9d05a19b6d9dd",
    "77d363cccdea6dc1b9e12d9a4de9f69630c172c4393ce0e2cc18300641c21edc",
    "4ba9caf37efebae354e9e44fe975da77c395317a0b9fa26904dff0d5bd258e3a",
    "3e100a3ed98bbf6faa17d068f8fcb37d12c3f8c87dfa3b5c880b4a92cf2a4739",
    "f8c7b70fd08e1bb7e2fb3b9348c6a34fdc5e35ed678b574fc0769ac5932f9d31",
    "0fa824589653608512c4103f5bc799bb9119be2dd9d920c3646548a5e38ff415",
    "7e1a2bacc50b6cc12222d49ce093d29065118a1f080f5e137c3adc65edc92303",
    "215411a2bec379e037e2c14aa85a23d66d74585c3e3bb57e0dee750f62b077d0",
    "d8f1392ac9175b9c7e8cdd9ecd69028d5f5d3fd5b67adc8f8643fba5f3142249",
    "82e267908993824e793d34666a8a779b6a87c0cb2fb44fb25e8f9597221381ca",
    "4e6faac03a68dac745fc2680db901906a26957153cf1cf7bc4b7a6ef65bc71cb",
    "5d82b2962b3ac425749d5713817db7e549a1ca89d6ae65a3609c9c1fb68caa39",
    "7a487e3d8f91d9be9d4414b4ecadc5f50f96d076559e07fed150e0fb87740521",
    "5bbaa59c1db28a0ebca954910c3b3f288e0c85a47521ae93852012efa1c74144",
    "627c3a3c2ae1f8f953bbe614015bcc0a91dc29407e64a9f2b0292678160cc73a",
    "94ea6f343c3fa6b1f4c73b0fd09d00aca1fbb5fff0b50a0ef720ed4160496dc7",
})

PUBLISHER_QR_SHA256 = frozenset(json.loads(
    Path(__file__).with_name("bookletQrObjects.json").read_text(encoding="utf-8")
)["sha256"])


def omit_publisher_logo(page):
    """Disable only verified logo objects in memory, without rewriting the PDF."""
    return _omit_image_streams(page, PUBLISHER_LOGO_SHA256)


def _omit_image_streams(page, hashes):
    omitted = []
    for obj in page.get_objects(filter=[pdfium.raw.FPDF_PAGEOBJ_IMAGE]):
        digest = hashlib.sha256(obj.get_data()).hexdigest()
        if digest not in hashes:
            continue
        if not pdfium.raw.FPDFPageObj_SetIsActive(obj, False):
            raise RuntimeError("Unable to omit a known publisher artwork object.")
        omitted.append({"sha256": digest, "bounds": obj.get_bounds()})
    return omitted


def omit_booklet_extras(page):
    """Remove exact reviewed logo and QR objects, including their own captions."""
    return [
        {**item, "kind": "logo" if item["sha256"] in PUBLISHER_LOGO_SHA256 else "qr"}
        for item in _omit_image_streams(page, PUBLISHER_LOGO_SHA256 | PUBLISHER_QR_SHA256)
    ]
