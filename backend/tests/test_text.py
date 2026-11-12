import unittest

from app.services.text import is_sensitive, make_title, normalise, tokens


class SensitiveTests(unittest.TestCase):
    def test_blocks_credentials_and_ids(self):
        for s in [
            "My password is hunter2",
            "my PIN is 4821",
            "card 4111 1111 1111 1111",
            "SSN 123-45-6789",
            "aadhaar 1234 5678 9012",
            "api key AIzaSyA1234567890abcdefghijklmnop",
            "account number 123456789012",
            "here is my seed phrase",
        ]:
            self.assertTrue(is_sensitive(s), s)

    def test_allows_normal_memories(self):
        for s in [
            "Prefers concise answers.",
            "Is learning Python and FastAPI.",
            "Lives in Bengaluru.",
            "Interested in photography and trekking.",
            "Works as a software engineer.",
        ]:
            self.assertFalse(is_sensitive(s), s)


class TitleTests(unittest.TestCase):
    def test_short(self):
        self.assertEqual(make_title("  Hello   world "), "Hello world")

    def test_first_line_only(self):
        self.assertEqual(make_title("First line\nsecond"), "First line")

    def test_truncates(self):
        t = make_title("x" * 200)
        self.assertEqual(len(t), 60)
        self.assertTrue(t.endswith("…"))

    def test_empty(self):
        self.assertEqual(make_title("   "), "New chat")


class MiscTests(unittest.TestCase):
    def test_tokens(self):
        self.assertEqual(tokens("I like Python, a lot!"), {"like", "python", "lot"})

    def test_normalise(self):
        self.assertEqual(normalise("Prefers Concise answers!"), normalise("prefers concise answers"))


if __name__ == "__main__":
    unittest.main()
