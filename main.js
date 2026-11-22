(function () {
    'use strict';

    const NAV_OFFSET = 80; // chiều cao thanh điều hướng (h-20)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ====== HIỆN DẦN THEO TỐC ĐỘ CUỘN ====== */
    const revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

    function updateReveal() {
        const vh = window.innerHeight;
        const start = vh * 0.97;   // phần tử bắt đầu hiện khi chạm mép dưới màn hình
        const span = vh * 0.27;    // hiện rõ hoàn toàn sau khi đi lên khoảng 27% chiều cao màn hình
        for (let i = 0; i < revealEls.length; i++) {
            const el = revealEls[i];
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue; // đang nằm trong tab bị ẩn
            let p = 1;
            if (!reduceMotion) {
                const baseTop = r.top - (el._shift || 0);
                const lag = (parseFloat(el.dataset.lag) || 0) * vh * 0.05;
                p = (start - lag - baseTop) / span;
                p = p < 0 ? 0 : (p > 1 ? 1 : p);
            }
            const shift = (1 - p) * 40;
            el._shift = shift;
            el.style.opacity = p.toFixed(3);
            el.style.transform = p >= 1 ? 'none' : 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
        }
    }

    /* ====== CUỘN MƯỢT (quán tính) ====== */
    let current = window.scrollY, target = current, running = false, lastT = 0;

    function maxScroll() {
        return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function frame(t) {
        const dt = Math.min(50, t - (lastT || t));
        lastT = t;
        const diff = target - current;
        if (Math.abs(diff) < 0.4) {
            current = target;
            running = false;
        } else {
            current += diff * (1 - Math.pow(1 - 0.11, dt / 16.67));
        }
        window.scrollTo(0, current);
        updateReveal();
        if (running) requestAnimationFrame(frame); else lastT = 0;
    }

    function smoothTo(y) {
        target = Math.max(0, Math.min(maxScroll(), y));
        if (reduceMotion) {
            window.scrollTo(0, target);
            current = target;
            updateReveal();
            return;
        }
        if (!running) {
            current = window.scrollY;
            running = true;
            requestAnimationFrame(frame);
        }
    }

    function canScrollInside(node, dy) {
        while (node && node !== document.body && node !== document.documentElement) {
            if (node.nodeType === 1) {
                const oy = getComputedStyle(node).overflowY;
                if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
                    const atTop = node.scrollTop <= 0;
                    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
                    if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return true;
                }
            }
            node = node.parentNode;
        }
        return false;
    }

    if (!reduceMotion) {
        window.addEventListener('wheel', function (e) {
            if (e.ctrlKey || e.defaultPrevented) return;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            let dy = e.deltaY;
            if (e.deltaMode === 1) dy *= 32;
            else if (e.deltaMode === 2) dy *= window.innerHeight;
            if (canScrollInside(e.target, dy)) return;
            e.preventDefault();
            if (!running) { current = window.scrollY; target = current; }
            target = Math.max(0, Math.min(maxScroll(), target + dy));
            if (!running) { running = true; requestAnimationFrame(frame); }
        }, { passive: false });
    }

    // Cuộn bằng bàn phím / kéo thanh cuộn: đồng bộ lại vị trí
    window.addEventListener('scroll', function () {
        if (running && Math.abs(window.scrollY - current) > 3) running = false;
        if (!running) { current = target = window.scrollY; }
        updateReveal();
    }, { passive: true });

    window.addEventListener('resize', updateReveal);

    /* ====== MENU "DỰ ÁN" → CUỘN TỚI THẺ BÀI ====== */
    function docTop(el) {          // offsetTop cộng dồn: không bị ảnh hưởng bởi transform đang chạy
        let y = 0;
        while (el) { y += el.offsetTop; el = el.offsetParent; }
        return y;
    }

    function goToLesson(id) {
        const card = document.getElementById(id);
        if (!card) return false;
        smoothTo(docTop(card) - NAV_OFFSET - 20);
        return true;
    }

    const dd = document.getElementById('navProjects');
    if (dd) dd.addEventListener('mouseleave', function () { dd.classList.remove('force-close'); });

    /* ====== CHUYỂN TRANG MƯỢT ====== */
    const root = document.documentElement;
    let leaving = false;

    function leaveTo(href) {
        if (leaving) return;
        leaving = true;
        root.classList.add('is-leaving');           // mờ dần ~0.22s rồi mới chuyển
        setTimeout(function () { window.location.href = href; }, 220);
    }

    // Quay lại bằng nút Back (trang lấy từ bộ nhớ đệm): bỏ trạng thái đang rời
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            leaving = false;
            root.classList.remove('is-leaving');
            root.classList.add('is-ready');
        }
    });

    document.addEventListener('click', function (e) {
        const a = e.target.closest('a');
        if (!a) return;
        if (dd && dd.contains(a)) { dd.classList.add('force-close'); a.blur(); }

        // Đang ở trang Dự án và bấm bài trong menu: cuộn mượt tại chỗ.
        if (a.dataset.lesson) {
            const id = a.hash.replace('#', '');
            if (document.getElementById(id)) {
                e.preventDefault();
                try { history.pushState(null, '', '#' + id); } catch (err) { /* file:// */ }
                goToLesson(id);
                return;
            }
        }

        // Link sang trang khác trong web: mờ dần rồi chuyển
        if (reduceMotion || e.defaultPrevented || e.button !== 0 ||
            e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (a.target === '_blank' || a.hasAttribute('download') || !a.getAttribute('href')) return;
        const url = new URL(a.href, window.location.href);
        if (url.protocol !== window.location.protocol || url.host !== window.location.host) return;
        if (url.pathname === window.location.pathname) {          // cùng trang
            if (!url.hash) { e.preventDefault(); smoothTo(0); }   // bấm đúng tab đang mở: cuộn lên đầu
            return;
        }
        e.preventDefault();
        leaveTo(url.href);
    });

    window.addEventListener('popstate', function () {
        const id = window.location.hash.replace('#', '');
        if (/^bai\d+$/.test(id)) goToLesson(id);
    });

    /* ====== KHỞI TẠO ====== */
    updateReveal();

    function markReady() { root.classList.add('is-ready'); }
    requestAnimationFrame(function () {
        const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 700); })]).then(function () {
            requestAnimationFrame(function () { requestAnimationFrame(markReady); });
        });
    });

    const initial = window.location.hash.replace('#', '');
    if (/^bai\d+$/.test(initial) && document.getElementById(initial)) {
        // mở thẳng projects.html#baiN: chờ Tailwind áp style xong rồi cuộn tới thẻ
        window.addEventListener('load', function () {
            setTimeout(function () { goToLesson(initial); }, 80);
        });
    }
})();
