document.addEventListener("DOMContentLoaded", function() {
    const openBtn = document.getElementById("openInvitation");

    if (openBtn) {
        openBtn.addEventListener("click", function() {
            const loadingScreen = document.getElementById("loadingScreen");
            const mainContent = document.getElementById("mainContent");

            if (loadingScreen) {
                loadingScreen.classList.add("screen-fade-out");
            }

            if (mainContent) {
                mainContent.style.display = "block";
                mainContent.style.opacity = "0";
            }

            setTimeout(() => {
                if (mainContent) {
                    mainContent.style.opacity = "1";
                }
                animateContentIn(cards[active]);
            }, 200);

            setTimeout(() => {
                if (loadingScreen) {
                    loadingScreen.style.display = "none";
                }
            }, 600);
        });
    }

    /* ============================
       Card Deck — Book Page Flip (Motion)
       ============================ */

    const deck = document.getElementById("cardDeck");
    const cards = deck ? Array.from(deck.querySelectorAll(".swipe-card")) : [];
    const dotsWrap = document.getElementById("deckDots");
    const prevArrow = document.getElementById("deckPrev");
    const nextArrow = document.getElementById("deckNext");
    const gestureHintLeft = document.getElementById("gestureHintLeft");
    const gestureHintRight = document.getElementById("gestureHintRight");
    const swipeLabel = document.getElementById("swipeLabel");

    // Motion is the vanilla-JS build of Framer Motion (loaded via CDN)
    const motionLib = window.Motion;
    let active = 0;
    let animating = false;

    // give every page its own shading overlay for the paper-fold shadow
    cards.forEach((card) => {
        const fold = document.createElement("div");
        fold.className = "page-fold";
        card.appendChild(fold);
    });

    function restState(i) {
        // already-turned pages lie flipped open at -180deg (the "read" pile)
        // pages not yet reached sit flat at 0deg (the "unread" pile)
        return i < active ? "rotateY(-180deg)" : "rotateY(0deg)";
    }

    function zFor(i) {
        return i < active ? i : cards.length - (i - active);
    }

    function applyTransform(el, transform, opacity, immediate) {
        if (!immediate && motionLib && typeof motionLib.animate === "function") {
            motionLib.animate(el, { transform, opacity }, {
                duration: 0.65,
                ease: [0.65, 0, 0.35, 1]
            });
        } else {
            el.style.transform = transform;
            el.style.opacity = opacity;
        }
    }

    function layoutDeck(immediate, keepOnTop) {
        cards.forEach((card, i) => {
            card.style.zIndex = card === keepOnTop ? 999 : zFor(i);
            card.style.pointerEvents = i === active ? "auto" : "none";
            applyTransform(card, restState(i), 1, immediate);
        });

        if (dotsWrap) {
            Array.from(dotsWrap.children).forEach((dot, i) => {
                dot.classList.toggle("active", i === active);
            });
        }
        if (prevArrow) prevArrow.disabled = active === 0;
        if (nextArrow) nextArrow.disabled = active === cards.length - 1;

        if (keepOnTop) {
            setTimeout(() => {
                keepOnTop.style.zIndex = zFor(cards.indexOf(keepOnTop));
            }, 650);
        }
    }

    function dismissHint() {
        if (gestureHintLeft) gestureHintLeft.classList.add("hidden");
        if (gestureHintRight) gestureHintRight.classList.add("hidden");
        if (swipeLabel) swipeLabel.classList.add("hidden");
    }

    // Staggered entrance of a card's content when it becomes active
    function animateContentIn(card) {
        if (!card || !motionLib || typeof motionLib.animate !== "function") return;

        const items = Array.from(card.children).filter(
            (el) => !el.classList.contains("corner") && !el.classList.contains("page-fold")
        );
        if (!items.length) return;

        const delayOption = typeof motionLib.stagger === "function"
            ? motionLib.stagger(0.07, { startDelay: 0.2 })
            : 0.2;

        motionLib.animate(items, {
            opacity: [0, 1],
            transform: ["translateY(26px) scale(0.97)", "translateY(0px) scale(1)"]
        }, {
            delay: delayOption,
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1]
        });
    }

    function flashFold(card) {
        const fold = card.querySelector(".page-fold");
        if (!fold) return;
        fold.classList.remove("is-flipping");
        void fold.offsetWidth; // restart the animation
        fold.classList.add("is-flipping");
    }

    function goTo(index) {
        const clamped = Math.max(0, Math.min(cards.length - 1, index));
        if (clamped === active || animating) {
            layoutDeck(false);
            return;
        }

        const forward = clamped > active;
        const turningCard = forward ? cards[active] : cards[clamped];

        animating = true;
        flashFold(turningCard);
        active = clamped;
        cards[active].scrollTop = 0;
        dismissHint();
        layoutDeck(false, turningCard);
        animateContentIn(cards[active]);

        setTimeout(() => { animating = false; }, 650);
    }

    if (cards.length) {
        if (dotsWrap) {
            cards.forEach((_, i) => {
                const dot = document.createElement("button");
                dot.type = "button";
                dot.setAttribute("aria-label", "Go to page " + (i + 1));
                dot.addEventListener("click", () => goTo(i));
                dotsWrap.appendChild(dot);
            });
        }

        if (prevArrow) prevArrow.addEventListener("click", () => goTo(active - 1));
        if (nextArrow) nextArrow.addEventListener("click", () => goTo(active + 1));

        document.addEventListener("keydown", (e) => {
            if (e.key === "ArrowRight") goTo(active + 1);
            if (e.key === "ArrowLeft") goTo(active - 1);
        });

        // Drag / swipe to physically turn the page
        let drag = null;
        let dragCardWidth = 0;

        deck.addEventListener("pointerdown", (e) => {
            if (animating) return;
            if (e.target.closest("button, a, iframe")) return;

            const activeCard = cards[active];
            if (!activeCard || !activeCard.contains(e.target)) return;

            const rect = activeCard.getBoundingClientRect();
            dragCardWidth = rect.width || 320;
            drag = {
                startX: e.clientX,
                startY: e.clientY,
                dx: 0,
                horizontal: null,
                card: activeCard,
                prevCard: active > 0 ? cards[active - 1] : null,
                progress: 0,
                dir: null,
                rectLeft: rect.left,
                rectWidth: rect.width
            };
        });

        window.addEventListener("pointermove", (e) => {
            if (!drag) return;

            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;

            if (drag.horizontal === null) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                drag.horizontal = Math.abs(dx) > Math.abs(dy);
                if (drag.horizontal) {
                    drag.card.classList.add("is-dragging");
                    dismissHint();
                } else {
                    drag = null; // vertical intent: let the card scroll
                    return;
                }
            }

            if (dx < 0) {
                // dragging left: turn the current page forward
                const progress = Math.max(0, Math.min(1, -dx / dragCardWidth));
                drag.card.style.transform = `rotateY(${-180 * progress}deg)`;
                const fold = drag.card.querySelector(".page-fold");
                if (fold) fold.style.opacity = Math.sin(progress * Math.PI) * 0.6;
                drag.progress = progress;
                drag.dir = "forward";
            } else if (dx > 0 && drag.prevCard) {
                // dragging right: flip the last-read page back
                const progress = Math.max(0, Math.min(1, dx / dragCardWidth));
                drag.prevCard.style.zIndex = 999;
                drag.prevCard.style.transform = `rotateY(${-180 + 180 * progress}deg)`;
                const fold = drag.prevCard.querySelector(".page-fold");
                if (fold) fold.style.opacity = Math.sin(progress * Math.PI) * 0.6;
                drag.progress = progress;
                drag.dir = "backward";
            }
        });

        function endDrag(e) {
            if (!drag) return;
            const { card, prevCard, progress, dir, horizontal, rectLeft, rectWidth, startX } = drag;
            card.classList.remove("is-dragging");
            const foldEl = (dir === "backward" && prevCard ? prevCard : card).querySelector(".page-fold");
            if (foldEl) foldEl.style.opacity = "";

            // If the pointer never moved enough to count as a drag, treat it
            // as a tap: right half of the page flips forward, left half flips back.
            const wasTap = horizontal === null;
            drag = null;

            if (wasTap) {
                const clickX = (e && typeof e.clientX === "number") ? e.clientX : startX;
                const onRightSide = (clickX - rectLeft) > rectWidth / 2;

                if (onRightSide && active < cards.length - 1) {
                    goTo(active + 1);
                } else if (!onRightSide && active > 0) {
                    goTo(active - 1);
                } else {
                    layoutDeck(false);
                }
                return;
            }

            const committed = progress > 0.35;

            if (dir === "forward" && committed && active < cards.length - 1) {
                goTo(active + 1);
            } else if (dir === "backward" && committed && active > 0) {
                goTo(active - 1);
            } else if (dir === "backward" && prevCard) {
                layoutDeck(false, prevCard);
            } else {
                layoutDeck(false);
            }
        }

        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);

        layoutDeck(true);
    }

    const enterBtn = document.getElementById("enterBtn");
    if (enterBtn) {
        enterBtn.addEventListener("click", function() {
            goTo(active + 1);
        });
    }

    const images = [
        "gallery1.JPG",
        "gallery2.JPG",
        "gallery3.JPG",
        "gallery4.JPG",
        "gallery5.JPG",
        "IMG_9666.JPG",
        "IMG_9672.JPG",
        "IMG_9716.JPG",
        "IMG_9721.JPG"
    ];

    let current = 0;
    const sliderImage = document.getElementById("sliderImage");
    const photoCount = document.getElementById("photoCount");
    const nextBtn = document.querySelector(".next");
    const prevBtn = document.querySelector(".prev");

    function showImage(index) {
        if (!sliderImage) return;

        const safeIndex = (index + images.length) % images.length;
        const nextSrc = images[safeIndex];

        if (photoCount) {
            photoCount.textContent = (safeIndex + 1) + " / " + images.length;
        }

        sliderImage.style.opacity = "0";
        setTimeout(() => {
            sliderImage.src = nextSrc;
            sliderImage.onload = () => {
                sliderImage.style.opacity = "1";
            };
            sliderImage.onerror = () => {
                sliderImage.src = "gallery1.JPG";
                sliderImage.style.opacity = "1";
            };
        }, 120);
    }

    function updateSlider() {
        showImage(current);
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", function() {
            current = (current + 1) % images.length;
            updateSlider();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", function() {
            current = (current - 1 + images.length) % images.length;
            updateSlider();
        });
    }

    updateSlider();

    setInterval(function() {
        current = (current + 1) % images.length;
        updateSlider();
    }, 5000);
});
