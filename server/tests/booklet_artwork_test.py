import hashlib
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import bookletArtwork


class BookletArtworkTests(unittest.TestCase):
    def test_qr_fragments_are_removed_without_removing_unlisted_diagrams(self):
        objects = []
        for data in [b"qr top", b"qr bottom and caption", b"graph with squares"]:
            obj = Mock()
            obj.get_data.return_value = data
            obj.get_bounds.return_value = (10, 20, 30, 40)
            objects.append(obj)
        page = Mock()
        page.get_objects.return_value = objects
        hashes = {hashlib.sha256(obj.get_data()).hexdigest() for obj in objects[:2]}
        with patch.object(bookletArtwork, "PUBLISHER_QR_SHA256", hashes), \
             patch.object(bookletArtwork.pdfium.raw, "FPDFPageObj_SetIsActive", return_value=True) as disable:
            result = bookletArtwork.omit_booklet_extras(page)
        self.assertEqual(disable.call_count, 2)
        self.assertEqual([row["kind"] for row in result], ["qr", "qr"])
        self.assertEqual([call.args[0] for call in disable.call_args_list], objects[:2])

    def test_only_exact_logo_stream_is_omitted(self):
        logo = Mock()
        logo.get_data.return_value = b"known logo"
        logo.get_bounds.return_value = (10, 20, 30, 40)
        diagram = Mock()
        diagram.get_data.return_value = b"question diagram, even if light grey"
        page = Mock()
        page.get_objects.return_value = [diagram, logo]
        digest = hashlib.sha256(b"known logo").hexdigest()
        with patch.object(bookletArtwork, "PUBLISHER_LOGO_SHA256", {digest}), \
             patch.object(bookletArtwork.pdfium.raw, "FPDFPageObj_SetIsActive", return_value=True) as disable:
            result = bookletArtwork.omit_publisher_logo(page)
        disable.assert_called_once_with(logo, False)
        self.assertEqual(result, [{"sha256": digest, "bounds": (10, 20, 30, 40)}])

    def test_render_fails_if_logo_cannot_be_omitted(self):
        logo = Mock()
        logo.get_data.return_value = b"logo"
        page = Mock()
        page.get_objects.return_value = [logo]
        digest = hashlib.sha256(b"logo").hexdigest()
        with patch.object(bookletArtwork, "PUBLISHER_LOGO_SHA256", {digest}), \
             patch.object(bookletArtwork.pdfium.raw, "FPDFPageObj_SetIsActive", return_value=False):
            with self.assertRaises(RuntimeError):
                bookletArtwork.omit_publisher_logo(page)


if __name__ == "__main__":
    unittest.main()
