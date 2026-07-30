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
       Card Swipe Deck (Motion)
       ============================ */

    const deck = document.getElementById("cardDeck");
    const cards = deck ? Array.from(deck.querySelectorAll(".swipe-card")) : [];
    const dotsWrap = document.getElementById("deckDots");
    const prevArrow = document.getElementById("deckPrev");
    const nextArrow = document.getElementById("deckNext");
    const swipeHint = document.getElementById("swipeHint");

    // Motion is the vanilla-JS build of Framer Motion (loaded via CDN)
    const motionLib = window.Motion;
    let active = 0;

    function stopAnimations(el) {
        if (typeof el.getAnimations !== "function") return;
        el.getAnimations().forEach((anim) => {
            try { anim.commitStyles(); } catch (err) { /* ignore */ }
            anim.cancel();
        });
    }

    function applyTransform(el, transform, opacity, immediate) {
        if (!immediate && motionLib && typeof motionLib.animate === "function") {
            motionLib.animate(el, { transform, opacity }, {
                type: "spring",
                stiffness: 210,
                damping: 26,
                mass: 0.9
            });
        } else {
            el.style.transform = transform;
            el.style.opacity = opacity;
        }
    }

    function layoutDeck(immediate) {
        cards.forEach((card, i) => {
            const depth = i - active;
            let transform;
            let opacity;

            if (depth < 0) {
                // Cards already swiped away: fly off to the left
                transform = "translateX(-120%) rotate(-8deg) scale(0.9)";
                opacity = 0;
            } else if (depth === 0) {
                transform = "translateX(0%) translateY(0px) rotate(0deg) scale(1)";
                opacity = 1;
            } else {
                // Cards waiting in the stack: peek out from behind the top
                // edge with a playful alternating tilt
                const d = Math.min(depth, 3);
                const tilt = (i % 2 === 0 ? 1 : -1) * d * 1.1;
                transform = `translateX(0%) translateY(${d * -14}px) rotate(${tilt}deg) scale(${1 - d * 0.04})`;
                opacity = depth > 3 ? 0 : 1;
            }

            card.style.zIndex = depth < 0 ? cards.length + 10 : cards.length - depth;
            card.style.pointerEvents = depth === 0 ? "auto" : "none";
            applyTransform(card, transform, opacity, immediate);
        });

        if (dotsWrap) {
            Array.from(dotsWrap.children).forEach((dot, i) => {
                dot.classList.toggle("active", i === active);
            });
        }
        if (prevArrow) prevArrow.disabled = active === 0;
        if (nextArrow) nextArrow.disabled = active === cards.length - 1;
    }

    function dismissHint() {
        if (swipeHint && !swipeHint.classList.contains("hidden")) {
            swipeHint.classList.add("hidden");
        }
    }

    // Staggered entrance of a card's content when it becomes active
    function animateContentIn(card) {
        if (!card || !motionLib || typeof motionLib.animate !== "function") return;

        const items = Array.from(card.children)
            .filter((el) => !el.classList.contains("corner"));
        if (!items.length) return;

        const delayOption = typeof motionLib.stagger === "function"
            ? motionLib.stagger(0.07, { startDelay: 0.12 })
            : 0.12;

        motionLib.animate(items, {
            opacity: [0, 1],
            transform: ["translateY(26px) scale(0.97)", "translateY(0px) scale(1)"]
        }, {
            delay: delayOption,
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1]
        });
    }

    function goTo(index) {
        const clamped = Math.max(0, Math.min(cards.length - 1, index));
        if (clamped === active) {
            layoutDeck(false);
            return;
        }
        active = clamped;
        cards[active].scrollTop = 0;
        dismissHint();
        layoutDeck(false);
        animateContentIn(cards[active]);
    }

    if (cards.length) {
        if (dotsWrap) {
            cards.forEach((_, i) => {
                const dot = document.createElement("button");
                dot.type = "button";
                dot.setAttribute("aria-label", "Go to card " + (i + 1));
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

        // Drag / swipe gesture on the active card
        let drag = null;

        deck.addEventListener("pointerdown", (e) => {
            if (e.target.closest("button, a, iframe")) return;
            const card = cards[active];
            if (!card || !card.contains(e.target)) return;
            drag = {
                startX: e.clientX,
                startY: e.clientY,
                dx: 0,
                startTime: performance.now(),
                horizontal: null,
                card
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
                    stopAnimations(drag.card);
                    drag.card.classList.add("is-dragging");
                } else {
                    drag = null; // vertical intent: let the card scroll
                    return;
                }
            }

            // Rubber-band resistance at either end of the deck
            const atEdge = (dx < 0 && active === cards.length - 1) || (dx > 0 && active === 0);
            drag.dx = atEdge ? dx * 0.3 : dx;

            drag.card.style.transform =
                `translateX(${drag.dx}px) rotate(${drag.dx * 0.04}deg) scale(1)`;
        });

        function endDrag() {
            if (!drag) return;
            const card = drag.card;
            card.classList.remove("is-dragging");

            const elapsed = performance.now() - drag.startTime;
            const velocity = drag.dx / Math.max(elapsed, 1); // px per ms
            const flungNext = drag.dx < -90 || (drag.dx < -30 && velocity < -0.5);
            const flungPrev = drag.dx > 90 || (drag.dx > 30 && velocity > 0.5);
            drag = null;

            if (flungNext && active < cards.length - 1) {
                goTo(active + 1);
            } else if (flungPrev && active > 0) {
                goTo(active - 1);
            } else {
                layoutDeck(false); // spring back into place
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
