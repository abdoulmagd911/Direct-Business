/* js/97-what-the-ingest-form-actually-read.js — fire #183, 2026-09-20.

   "Ingest invoice / booking / offer" is dressed as a document reader. Driven live, it reads
   nothing but the file NAME:

     · every field label carried a colour-coded confidence percentage — all of them literals typed
       into the source. With no file at all, the invoice form showed nine, including a green
       "Subtotal (pre-VAT) 94%" over an empty box and "Status 100%" over an untouched dropdown;
     · the "📋 Recognised: Amadeus IUR invoice template" badge, and the document language beside
       it, came from matching a word in the file name;
     · and the only value ever taken from the file was four digits pulled out of its name.

   The percentages and the false claims are gone at source (js/core/core-06). What is left is the
   other half: saying what the form DID read, and admitting what it did not.

   This layer adds two things to an ingest form, and nothing anywhere else:
     1. one line at the top: the file is kept as-is and nothing inside it has been read, so every
        value below is yours to check;
     2. a small "taken from the file name" mark on the reference field — but ONLY when that is
        true. It is proved, not assumed: the digits sitting in the box must also appear in the
        file name shown in the form's own title. With no file, or a name with no digits, the
        reference is just a fresh number and gets no mark. That is the brake — a mark that always
        appears is the same lie in a smaller font.                                              */
(function () {
  try {
    var MARK = 'v97';
    function ar() { try { return (typeof LANG !== 'undefined' && LANG === 'ar'); } catch (_) { return false; } }
    function L(en, a) { return ar() ? a : en; }

    function refField(m) { return m.querySelector('#ig_ref') || m.querySelector('#ig_num'); }

    /* the file name, as the form's own title prints it: "Ingest booking — <name>" */
    function fileNameFrom(m) {
      var h = m.querySelector('h2, h3'); if (!h) return '';
      var t = String(h.textContent || '');
      var i = t.indexOf(' — '); if (i < 0) return '';
      return t.slice(i + 3).trim();
    }

    function digitsOf(s) { var m = String(s || '').match(/\d{3,}/g); return m || []; }

    function decorate() {
      var m = document.getElementById('modal'); if (!m) return;
      var box = m.querySelector('.mb') || m;        /* the form body, below the title bar */
      /* an ingest form is any form built from ingestModal — its fields are all `ig_…`. Do NOT
         key this off the reference box: the offer form has no reference at all, and keying off
         it left that one form with no sentence, which the probe caught. */
      if (!box.querySelector('[id^="ig_"]')) return;
      if (box.querySelector('[data-' + MARK + '-said]')) return; /* already done for this form */

      var line = document.createElement('div');
      line.setAttribute('data-' + MARK + '-said', '1');
      line.style.cssText = 'margin:0 0 12px;padding:8px 11px;border-radius:9px;background:#F6F7F9;' +
        'border:1px solid #E6E8EC;color:#5b6178;font-size:12px;line-height:1.6';
      line.textContent = L(
        'The file is kept exactly as you sent it. Nothing inside it has been read — every value below is yours to fill in and check.',
        'يُحفظ الملف كما أرسلته تمامًا. لم يُقرأ أي شيء بداخله — كل قيمة بالأسفل عليك إدخالها والتحقق منها.');
      box.insertBefore(line, box.firstChild);

      /* only mark the reference when the digits in it really did come out of the file name */
      var ref = refField(box); if (!ref) return;    /* the offer form has none — the line is enough */
      var fname = fileNameFrom(m);
      var inName = digitsOf(fname);
      var inRef = digitsOf(ref.value);
      var earned = !!fname && inRef.some(function (d) { return inName.indexOf(d) >= 0; });
      if (!earned) return;
      var lab = ref.parentElement && ref.parentElement.querySelector('label');
      if (!lab || lab.querySelector('[data-' + MARK + '-from]')) return;
      var tag = document.createElement('span');
      tag.setAttribute('data-' + MARK + '-from', '1');
      tag.style.cssText = 'display:inline-block;margin-inline-start:6px;background:#EEF4FF;color:#2E5AAC;' +
        'border:1px solid #CFDDF7;border-radius:9px;padding:1px 7px;font-size:10.5px;font-weight:700';
      tag.textContent = L('taken from the file name', 'مأخوذ من اسم الملف');
      lab.appendChild(tag);
    }

    var _om = window.openModal;
    if (typeof _om === 'function') {
      window.openModal = function () {
        var out = _om.apply(this, arguments);
        try { setTimeout(decorate, 0); setTimeout(decorate, 240); } catch (_) {}
        return out;
      };
    }
    try { window.v97DescribeIngest = decorate; } catch (_) {}
  } catch (e) { try { console.warn('v97', e); } catch (_) {} }
})();
