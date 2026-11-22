/* ==========================================================
   Body Scent — shared script (no external libraries)
   - product.html : product cards + mood filter
   - order.html   : prefill form from URL, submit to Apps Script
   - admin.html   : orders table from published Google Sheet CSV
   Each section runs only if its elements exist on the page.
   ========================================================== */

(function () {
  'use strict';

  var EXEC_URL = 'https://script.google.com/macros/s/AKfycbxTDy_S7cfUMuY8OklMtwKgnojefgND6XDa7YB9Z-RIgkXqrvJ9l0xsWi8NWjxjcFaF/exec';
  var CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_feTln13CI_RHKAVyR6hQmKikn5zfscU82lfdlh21J8fnSBdDGqD3w9b_AaCSagsht0bGHKHD55R6/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  /* ---------- small helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatPrice(n) {
    return Number(n).toLocaleString('th-TH') + ' บาท';
  }

  /* ==========================================================
     1) product.html
     ========================================================== */

  function initProducts() {
    var filterBar = document.getElementById('filter-bar');
    var list = document.getElementById('product-list');
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = 'all';

    function buildFilterBar() {
      filterBar.innerHTML = '';
      MOODS.forEach(function (m) {
        var btn = el('button', 'filter-btn');
        btn.type = 'button';
        btn.dataset.mood = m.key;

        if (m.key !== 'all') {
          var dot = el('span', 'mood-dot');
          dot.dataset.mood = m.key;
          btn.appendChild(dot);
        }
        btn.appendChild(document.createTextNode(m.label));

        btn.addEventListener('click', function () {
          setMood(m.key);
        });
        filterBar.appendChild(btn);
      });
    }

    function updateButtons() {
      var buttons = filterBar.querySelectorAll('.filter-btn');
      for (var i = 0; i < buttons.length; i++) {
        var active = buttons[i].dataset.mood === currentMood;
        buttons[i].classList.toggle('active', active);
        buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    }

    function createCard(p) {
      var card = el('article', 'product-card');
      card.dataset.mood = p.mood;

      var imgWrap = el('div', 'product-card__image');
      var img = document.createElement('img');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      imgWrap.appendChild(img);

      var body = el('div', 'product-card__body');

      var dot = el('span', 'mood-dot');
      dot.dataset.mood = p.mood;

      var name = el('h3', null, p.name);

      var metaText = p.size || (p.type === 'rollon' ? 'โรลออน' : '');
      var meta = el('p', 'meta', metaText);

      var price = el('div', 'price', formatPrice(p.price));

      // item = name + size (e.g. "น้ำหอมฉีดตัว Fresh เล็ก 30ml")
      var itemLabel = (p.name + ' ' + (p.size || '')).trim();
      var link = el('a', 'btn btn--accent', 'สั่งซื้อ');
      link.href =
        'order.html?item=' + encodeURIComponent(itemLabel) +
        '&price=' + encodeURIComponent(p.price);

      body.appendChild(dot);
      body.appendChild(name);
      if (metaText) body.appendChild(meta);
      body.appendChild(price);
      body.appendChild(link);

      card.appendChild(imgWrap);
      card.appendChild(body);
      return card;
    }

    function render() {
      list.innerHTML = '';
      var shown = products.filter(function (p) {
        return currentMood === 'all' || p.mood === currentMood;
      });

      if (!shown.length) {
        list.appendChild(el('p', null, 'ยังไม่มีสินค้าในหมวดนี้'));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(createCard(p));
      });
    }

    function setMood(mood) {
      currentMood = mood;
      updateButtons();
      render();
    }

    buildFilterBar();

    // ?mood=xxx → filter automatically on load (ignore unknown values)
    var wanted = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
    var valid = MOODS.some(function (m) { return m.key === wanted; });
    currentMood = valid ? wanted : 'all';
    updateButtons();

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render();
      })
      .catch(function (error) {
        console.error(error);
        list.innerHTML = '';
        list.appendChild(el('p', null, 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง'));
      });
  }

  /* ==========================================================
     2) order.html
     ========================================================== */

  function initOrder() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    var itemsInput = document.getElementById('items');
    var totalInput = document.getElementById('total');

    // Prefill BOTH items and total from the URL
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');
    if (item !== null && itemsInput) itemsInput.value = item;
    if (price !== null && totalInput) totalInput.value = price;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var payload = {
        customerName: document.getElementById('customerName').value,
        contact: document.getElementById('contact').value,
        items: document.getElementById('items').value,
        total: document.getElementById('total').value,
        note: document.getElementById('note').value
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(EXEC_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  /* ==========================================================
     3) admin.html
     ========================================================== */

  // Minimal CSV parser: quoted fields, escaped quotes (""), commas and
  // line breaks inside quotes, \r\n or \n row endings.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }

    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }

    // drop completely empty rows
    return rows.filter(function (r) {
      return r.some(function (cell) { return cell.trim() !== ''; });
    });
  }

  function initAdmin() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    var COLS = 6;

    function message(text) {
      tbody.innerHTML = '';
      var tr = document.createElement('tr');
      var td = el('td', null, text);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    message('กำลังโหลดข้อมูล...');

    // timestamp param avoids a stale cached copy
    var url = CSV_URL + (CSV_URL.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // The sheet may or may not have a header row: a data row starts
        // with a date/time (digit), so skip the first row otherwise.
        if (rows.length && !/^\s*\d/.test(rows[0][0] || '')) rows.shift();

        if (!rows.length) {
          message('ยังไม่มีคำสั่งซื้อ');
          return;
        }

        rows.reverse(); // rows are appended over time → newest first

        tbody.innerHTML = '';
        rows.forEach(function (r) {
          var tr = document.createElement('tr');
          for (var i = 0; i < COLS; i++) {
            // textContent keeps customer-entered text from being run as HTML
            tr.appendChild(el('td', null, r[i] !== undefined ? r[i] : ''));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        message('ไม่สามารถโหลดข้อมูลได้ กรุณารีเฟรชหน้าอีกครั้ง');
      });
  }

  /* ---------- run ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    initProducts();
    initOrder();
    initAdmin();
  });
})();
