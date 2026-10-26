import SpriteKit
import DurakGameCore
import SwiftUI

/// A SpriteKit card with baked face textures and native SKAction flights.
/// Textures always bake at `CardTextureCache.canonicalSize`; `cardSize` is display-only.
final class CardNode: SKNode {
    let card: Card
    private(set) var isFaceUp: Bool
    /// On-screen point size (hand / table / deck / spectator). Texture bake is always canonical.
    var cardSize: CGSize
    private var appearance: AppearancePreset

    /// Legal-play flag for logic only — no visual glow/outline.
    var isPlayable: Bool = false

    var originalPosition: CGPoint = .zero
    var originalZPosition: CGFloat = 0
    var originalRotation: CGFloat = 0

    private let containerNode = SKNode()
    private var shadowNode: SKSpriteNode?
    private var frontSprite: SKSpriteNode?
    private var backSprite: SKSpriteNode?
    private(set) var isLifted: Bool = false
    /// Display size applied after an in-flight handoff (no texture rebake).
    private var deferredSize: CGSize?

    /// Trump peek helpers (no-op with baked sprites; kept for DeckPileNode API).
    var centerSuitRotation: CGFloat = 0
    var centerSuitOffset: CGPoint = .zero

    init(
        card: Card,
        isFaceUp: Bool = true,
        size: CGSize = CardTextureCache.canonicalSize,
        appearance: AppearancePreset = getAppearance(.green)
    ) {
        self.card = card
        self.isFaceUp = isFaceUp
        self.cardSize = size
        self.appearance = appearance
        super.init()

        addChild(containerNode)
        CardTextureCache.noteActiveAppearance(appearance.id)
        renderCard()
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func updateAppearance(_ appearance: AppearancePreset) {
        guard self.appearance.id != appearance.id else { return }
        self.appearance = appearance
        CardTextureCache.noteActiveAppearance(appearance.id)
        frontSprite = nil
        backSprite = nil
        renderCard()
    }

    /// Display-size only — never rebakes (canonical texture + mipmaps handle downscale).
    func updateSize(_ newSize: CGSize) {
        guard abs(newSize.width - cardSize.width) > 0.05
            || abs(newSize.height - cardSize.height) > 0.05 else { return }
        cardSize = newSize
        applyDisplaySize()
    }

    private func applyDisplaySize() {
        frontSprite?.size = cardSize
        backSprite?.size = cardSize
        shadowNode?.size = cardSize
    }

    private func renderCard() {
        containerNode.removeAllChildren()
        frontSprite = nil
        backSprite = nil
        buildShadowNode()

        if isFaceUp {
            ensureFrontSprite()
            // Back deferred until flip — saves bake cost for face-up cards.
        } else {
            ensureBackSprite()
        }
        applyDisplaySize()
    }

    private func ensureFrontSprite() {
        if frontSprite == nil {
            let front = SKSpriteNode(texture: CardTextureCache.front(card: card, appearance: appearance))
            front.size = cardSize
            front.isHidden = !isFaceUp
            containerNode.addChild(front)
            frontSprite = front
        } else {
            frontSprite?.isHidden = !isFaceUp
        }
    }

    private func ensureBackSprite() {
        if backSprite == nil {
            let back = SKSpriteNode(texture: CardTextureCache.back(appearance: appearance))
            back.size = cardSize
            back.isHidden = isFaceUp
            containerNode.addChild(back)
            backSprite = back
        } else {
            backSprite?.isHidden = isFaceUp
        }
    }

    private func buildShadowNode() {
        shadowNode?.removeFromParent()
        let shadow = SKSpriteNode(texture: CardTextureCache.shadow())
        shadow.size = cardSize
        shadow.position = CGPoint(x: 0, y: -2)
        shadow.xScale = 0.98
        shadow.yScale = 0.98
        shadow.zPosition = -1
        shadow.alpha = isLifted ? 0.88 : 0.58
        addChild(shadow)
        shadowNode = shadow
    }

    // MARK: - Elevation

    enum FlightStyle {
        case place
        case flick
        case snapBack
        case reflow
        case takeIn

        var duration: TimeInterval {
            switch self {
            case .place: return 0.22
            case .flick: return 0.18
            case .snapBack: return 0.24
            case .reflow: return 0.20
            case .takeIn: return 0.32
            }
        }

        var arcFactor: CGFloat {
            switch self {
            case .place: return 0.12
            case .flick: return 0.18
            case .snapBack: return 0.06
            case .reflow: return 0.03
            case .takeIn: return 0.14
            }
        }

        var landPunch: CGFloat {
            switch self {
            case .place: return 1.03
            case .flick: return 1.045
            case .takeIn: return 1.025
            case .snapBack, .reflow: return 1.0
            }
        }

        var timingMode: SKActionTimingMode {
            switch self {
            case .place, .flick, .takeIn: return .easeOut
            case .reflow, .snapBack: return .easeInEaseOut
            }
        }
    }

    func setLifted(_ lifted: Bool, animated: Bool = true, duration overrideDuration: TimeInterval? = nil) {
        self.isLifted = lifted
        let reduce = UIAccessibility.isReduceMotionEnabled
        let duration: TimeInterval = {
            if reduce || !animated { return 0 }
            if let overrideDuration { return overrideDuration }
            return lifted ? 0.10 : 0.16
        }()

        let liftRootScale: CGFloat = 1.07
        let liftY: CGFloat = 10
        let targetRootScale: CGFloat = lifted ? liftRootScale : 1.0
        let targetContainerY: CGFloat = lifted ? liftY : 0
        let targetShadowPos: CGPoint = lifted ? CGPoint(x: 2, y: -20) : CGPoint(x: 0, y: -2)
        let targetShadowScale: CGFloat = lifted ? 1.16 : 0.98
        let targetShadowAlpha: CGFloat = lifted ? 0.88 : 0.58

        containerNode.removeAllActions()
        containerNode.setScale(1.0)
        removeAction(forKey: "liftRootScale")
        removeAction(forKey: "liftContainerY")

        if duration <= 0 {
            setScale(targetRootScale)
            containerNode.position = CGPoint(x: 0, y: targetContainerY)
            shadowNode?.position = targetShadowPos
            shadowNode?.setScale(targetShadowScale)
            shadowNode?.alpha = targetShadowAlpha
            return
        }

        let scaleAct = SKAction.scale(to: targetRootScale, duration: duration)
        scaleAct.timingMode = .easeOut
        run(scaleAct, withKey: "liftRootScale")

        let rise = SKAction.moveTo(y: targetContainerY, duration: duration)
        rise.timingMode = .easeOut
        containerNode.run(rise, withKey: "liftContainerY")

        if let shadow = shadowNode {
            let moveShadow = SKAction.move(to: targetShadowPos, duration: duration)
            moveShadow.timingMode = .easeOut
            let scaleShadow = SKAction.scale(to: targetShadowScale, duration: duration)
            scaleShadow.timingMode = .easeOut
            let fadeShadow = SKAction.fadeAlpha(to: targetShadowAlpha, duration: duration)
            fadeShadow.timingMode = .easeOut
            shadow.run(SKAction.group([moveShadow, scaleShadow, fadeShadow]), withKey: "liftShadow")
        }
    }

    /// Scale-only handoff resize — defers display-size apply until `commitDeferredSize()` / flight end.
    func preserveVisualSize(thenResizeTo newSize: CGSize) {
        let visualWidth = cardSize.width * xScale * containerNode.xScale
        containerNode.setScale(1.0)
        deferredSize = newSize
        setScale(visualWidth / max(newSize.width, 1))
    }

    func commitDeferredSize() {
        guard let deferred = deferredSize else { return }
        deferredSize = nil
        cardSize = deferred
        applyDisplaySize()
        setScale(1.0)
    }

    // MARK: - Animations

    func flip(toFaceUp: Bool, duration: TimeInterval = 0.20, completion: (() -> Void)? = nil) {
        guard isFaceUp != toFaceUp else {
            completion?()
            return
        }

        // Lazy-bake the destination face before the mid-flip swap.
        if toFaceUp {
            ensureFrontSprite()
        } else {
            ensureBackSprite()
        }

        let reduce = UIAccessibility.isReduceMotionEnabled
        let effective = reduce ? 0 : duration
        if effective <= 0 {
            isFaceUp = toFaceUp
            frontSprite?.isHidden = !toFaceUp
            backSprite?.isHidden = toFaceUp
            completion?()
            return
        }

        let half = effective / 2
        let scaleDown = SKAction.scaleX(to: 0.05, duration: half)
        scaleDown.timingMode = .easeIn
        let swap = SKAction.run { [weak self] in
            guard let self else { return }
            self.isFaceUp = toFaceUp
            self.frontSprite?.isHidden = !toFaceUp
            self.backSprite?.isHidden = toFaceUp
        }
        let scaleUp = SKAction.scaleX(to: 1.0, duration: half)
        scaleUp.timingMode = .easeOut
        containerNode.run(SKAction.sequence([scaleDown, swap, scaleUp])) {
            completion?()
        }
    }

    func flyTo(
        position: CGPoint,
        rotation: CGFloat = 0,
        zPosition: CGFloat? = nil,
        scale: CGFloat? = nil,
        duration: TimeInterval = 0.22,
        style: FlightStyle = .place,
        onImpact: (() -> Void)? = nil,
        completion: (() -> Void)? = nil
    ) {
        if let z = zPosition {
            self.zPosition = z
        }

        let reduce = UIAccessibility.isReduceMotionEnabled
        let effectiveDuration = reduce ? 0 : duration
        removeAction(forKey: "flyTo")
        removeAction(forKey: "flyToCompletion")
        removeAction(forKey: "flyToImpact")
        removeAction(forKey: "landPunch")

        let start = self.position
        let end = position
        let startRot = zRotation
        let endRot = rotation
        let startScale = xScale
        let endScale = scale ?? startScale
        let travel = hypot(end.x - start.x, end.y - start.y)
        let rotDelta = abs(endRot - startRot)
        let scaleDelta = abs(endScale - startScale)

        let finish: () -> Void = { [weak self] in
            guard let self else {
                completion?()
                return
            }
            self.position = end
            self.zRotation = endRot
            if let scale { self.setScale(scale) }
            self.commitDeferredSize()
            completion?()
        }

        if travel < 0.75 && rotDelta < 0.002 && scaleDelta < 0.002 {
            finish()
            onImpact?()
            return
        }

        let arcFloor: CGFloat = (style == .reflow || style == .snapBack) ? 0 : 8
        let arcHeight: CGFloat = reduce ? 0 : min(44, max(arcFloor, travel * style.arcFactor))
        let mid = CGPoint(
            x: (start.x + end.x) * 0.5,
            y: (start.y + end.y) * 0.5 + arcHeight
        )

        if effectiveDuration <= 0 {
            onImpact?()
            finish()
            return
        }

        let path = CGMutablePath()
        path.move(to: start)
        path.addQuadCurve(to: end, control: mid)

        let follow = SKAction.follow(path, asOffset: false, orientToPath: false, duration: effectiveDuration)
        follow.timingMode = style.timingMode

        let rotate = SKAction.rotate(toAngle: endRot, duration: effectiveDuration, shortestUnitArc: true)
        rotate.timingMode = style.timingMode

        var group: [SKAction] = [follow, rotate]
        if scale != nil {
            let scaleAct = SKAction.scale(to: endScale, duration: effectiveDuration)
            scaleAct.timingMode = style.timingMode
            group.append(scaleAct)
        }

        run(SKAction.group(group), withKey: "flyTo")

        if let onImpact {
            let impactDelay: TimeInterval = travel < 10
                ? min(0.04, effectiveDuration * 0.25)
                : effectiveDuration * 0.68
            run(SKAction.sequence([
                SKAction.wait(forDuration: impactDelay),
                SKAction.run(onImpact)
            ]), withKey: "flyToImpact")
        }

        let landPunch = style.landPunch
        run(SKAction.sequence([
            SKAction.wait(forDuration: effectiveDuration),
            SKAction.run { [weak self] in
                guard let self else {
                    completion?()
                    return
                }
                self.position = end
                self.zRotation = endRot
                if let scale { self.setScale(scale) }
                self.commitDeferredSize()

                if landPunch > 1.001 && !UIAccessibility.isReduceMotionEnabled {
                    let base = scale ?? self.xScale
                    let up = SKAction.scale(to: base * landPunch, duration: 0.045)
                    up.timingMode = .easeOut
                    let down = SKAction.scale(to: base, duration: 0.075)
                    down.timingMode = .easeIn
                    self.run(SKAction.sequence([up, down]), withKey: "landPunch")
                }
                completion?()
            }
        ]), withKey: "flyToCompletion")
    }
}

// MARK: - Texture cache

/// Bakes every card at a single canonical point size; consumers display via sprite.size + mipmaps.
enum CardTextureCache {
    static let canonicalSize = CGSize(width: 90, height: 126)

    /// Supersample factor for `spriteScale` / lift / land punch. Set from GameScene.updateLayout.
    static var displayScale: CGFloat = 1.0 {
        didSet {
            let next = max(1.0, displayScale)
            guard abs(next - appliedDisplayScale) > 0.001 else { return }
            clearAll()
            appliedDisplayScale = next
        }
    }

    private static var appliedDisplayScale: CGFloat = 1.0
    private static var activeAppearanceId: AppearanceId?
    private static var fronts: [String: SKTexture] = [:]
    private static var backs: [String: SKTexture] = [:]
    private static var shadowTexture: SKTexture?
    private static let lock = NSLock()

    private static var bakeScale: CGFloat {
        max(1.0, UIScreen.main.scale * max(1.0, displayScale))
    }

    /// Clears stale theme textures once when appearance changes (safe across a sync loop).
    static func noteActiveAppearance(_ id: AppearanceId) {
        lock.lock()
        defer { lock.unlock() }
        guard activeAppearanceId != id else { return }
        activeAppearanceId = id
        fronts.removeAll(keepingCapacity: false)
        backs.removeAll(keepingCapacity: false)
        // Shadow is theme-agnostic — keep it.
    }

    static func clearAll() {
        lock.lock()
        fronts.removeAll(keepingCapacity: false)
        backs.removeAll(keepingCapacity: false)
        shadowTexture = nil
        lock.unlock()
    }

    /// Warm a few faces before deal completes (optional, non-blocking caller).
    static func prefetch(cards: [Card], appearance: AppearancePreset) {
        noteActiveAppearance(appearance.id)
        _ = back(appearance: appearance)
        _ = shadow()
        for card in cards.prefix(8) {
            _ = front(card: card, appearance: appearance)
        }
    }

    private static func densKey() -> String {
        "d\(Int((bakeScale * 100).rounded()))"
    }

    private static func configureTexture(_ texture: SKTexture) {
        texture.filteringMode = .linear
        // Off: hand displays near 1× bake density; mips soften rims into “pixels.”
        texture.usesMipmaps = false
    }

    private static func prepareContext(_ cg: CGContext) {
        cg.setShouldAntialias(true)
        cg.setAllowsAntialiasing(true)
        cg.interpolationQuality = .high
    }

    private static func cornerRadius(for size: CGSize) -> CGFloat {
        min(8, size.width * 0.09)
    }

    private static func roundedPath(in rect: CGRect, radius: CGFloat) -> UIBezierPath {
        UIBezierPath(roundedRect: rect, cornerRadius: max(1, radius))
    }

    private static func lighterTint(_ color: UIColor, amount: CGFloat = 0.12) -> UIColor {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return UIColor(
            red: min(1, r + (1 - r) * amount),
            green: min(1, g + (1 - g) * amount),
            blue: min(1, b + (1 - b) * amount),
            alpha: a
        )
    }

    private static func fillVerticalGradient(
        in rect: CGRect,
        cornerRadius: CGFloat,
        top: UIColor,
        bottom: UIColor,
        cg: CGContext
    ) {
        let fillInset: CGFloat = 0.25
        let fillRect = rect.insetBy(dx: fillInset, dy: fillInset)
        let path = roundedPath(in: fillRect, radius: cornerRadius - fillInset)
        cg.saveGState()
        path.addClip()
        let colors = [top.cgColor, bottom.cgColor] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
            cg.drawLinearGradient(
                gradient,
                start: CGPoint(x: fillRect.midX, y: fillRect.minY),
                end: CGPoint(x: fillRect.midX, y: fillRect.maxY),
                options: []
            )
        }
        cg.restoreGState()
    }

    private static func strokeDualRim(
        in rect: CGRect,
        cornerRadius: CGFloat,
        outer: UIColor,
        outerWidth: CGFloat,
        innerHighlight: UIColor,
        innerWidth: CGFloat
    ) {
        let outerInset = max(0.45, outerWidth * 0.5)
        let outerRect = rect.insetBy(dx: outerInset, dy: outerInset)
        let outerPath = roundedPath(in: outerRect, radius: cornerRadius - outerInset)
        outer.setStroke()
        outerPath.lineWidth = outerWidth
        outerPath.lineJoinStyle = .round
        outerPath.stroke()

        let innerInset = outerInset + 1.1
        let innerRect = rect.insetBy(dx: innerInset, dy: innerInset)
        guard innerRect.width > 4, innerRect.height > 4 else { return }
        let innerPath = roundedPath(in: innerRect, radius: max(1, cornerRadius - innerInset))
        innerHighlight.setStroke()
        innerPath.lineWidth = innerWidth
        innerPath.lineJoinStyle = .round
        innerPath.stroke()
    }

    private static func addTopBevel(in rect: CGRect, cornerRadius: CGFloat, cg: CGContext) {
        let inset: CGFloat = 1.2
        let bevelRect = rect.insetBy(dx: inset, dy: inset)
        cg.saveGState()
        roundedPath(in: bevelRect, radius: max(1, cornerRadius - inset)).addClip()
        let colors = [
            UIColor.white.withAlphaComponent(0.14).cgColor,
            UIColor.white.withAlphaComponent(0).cgColor
        ] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
            cg.drawLinearGradient(
                gradient,
                start: CGPoint(x: bevelRect.midX, y: bevelRect.minY),
                end: CGPoint(x: bevelRect.midX, y: bevelRect.minY + bevelRect.height * 0.22),
                options: []
            )
        }
        cg.restoreGState()
    }

    // MARK: - Public accessors

    static func front(card: Card, appearance: AppearancePreset) -> SKTexture {
        let key = "f|\(appearance.id.rawValue)|\(card.suit.rawValue)|\(card.rank.rawValue)|\(densKey())|home25"
        lock.lock()
        if let cached = fronts[key] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        // Bake outside the lock — renderFront takes suitGlyph lock (NSLock is not recursive).
        let texture = SKTexture(image: renderFront(card: card, appearance: appearance))
        configureTexture(texture)

        lock.lock()
        fronts[key] = texture
        lock.unlock()
        return texture
    }

    static func back(appearance: AppearancePreset) -> SKTexture {
        let key = "b|\(appearance.id.rawValue)|\(densKey())"
        lock.lock()
        if let cached = backs[key] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        let texture = SKTexture(image: renderBack(appearance: appearance))
        configureTexture(texture)

        lock.lock()
        backs[key] = texture
        lock.unlock()
        return texture
    }

    static func shadow() -> SKTexture {
        lock.lock()
        if let cached = shadowTexture {
            lock.unlock()
            return cached
        }
        lock.unlock()

        let texture = SKTexture(image: renderShadow())
        configureTexture(texture)

        lock.lock()
        shadowTexture = texture
        lock.unlock()
        return texture
    }

    // MARK: - Face (matches HomeView.miniPlayingCard)

    private static func renderFront(card: Card, appearance: AppearancePreset) -> UIImage {
        let size = canonicalSize
        let format = UIGraphicsImageRendererFormat()
        format.scale = bakeScale
        format.opaque = false
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let radius = cornerRadius(for: size)
        return renderer.image { ctx in
            let cg = ctx.cgContext
            prepareContext(cg)
            let rect = CGRect(origin: .zero, size: size)

            // Flat face + single inset stroke (Home: fill + 1pt faceEdge).
            // Larger fill inset keeps AA fringe inside the texture under fan rotation.
            let fillInset: CGFloat = 0.5
            let fillRect = rect.insetBy(dx: fillInset, dy: fillInset)
            let fillPath = roundedPath(in: fillRect, radius: max(1, radius - fillInset))
            UIColor(appearance.card.face).setFill()
            fillPath.fill()

            let strokeWidth: CGFloat = 1.0
            let strokeInset = max(0.5, strokeWidth * 0.5)
            let strokeRect = rect.insetBy(dx: strokeInset, dy: strokeInset)
            let strokePath = roundedPath(in: strokeRect, radius: max(1, radius - strokeInset))
            UIColor(appearance.card.faceEdge).setStroke()
            strokePath.lineWidth = strokeWidth
            strokePath.lineJoinStyle = .round
            strokePath.stroke()

            let isRed = card.suit == .hearts || card.suit == .diamonds
            let suitColor = isRed
                ? UIColor(appearance.card.suitRed)
                : UIColor(appearance.card.suitBlack)
            let rank = rankSymbol(card.rank)
            let suit = suitUnicode(card.suit)

            // Home: padding leading 5 / top 4, rank 0.20w heavy, suit 0.17w bold, spacing -2.
            let padL: CGFloat = 5
            let padT: CGFloat = 4
            let rankFont = UIFont.systemFont(ofSize: size.width * 0.20, weight: .heavy)
            let suitFont = UIFont.systemFont(ofSize: size.width * 0.17, weight: .bold)
            var rankAttrs: [NSAttributedString.Key: Any] = [.font: rankFont, .foregroundColor: suitColor]
            if rank == "10" { rankAttrs[.kern] = -1.2 }
            let suitAttrs: [NSAttributedString.Key: Any] = [.font: suitFont, .foregroundColor: suitColor]
            let centerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: size.width * 0.40, weight: .bold),
                .foregroundColor: suitColor.withAlphaComponent(0.9)
            ]

            let drawIndex: () -> Void = {
                (rank as NSString).draw(at: CGPoint(x: padL, y: padT), withAttributes: rankAttrs)
                // Home VStack spacing -2 ≈ overlap slightly under rank line height.
                (suit as NSString).draw(
                    at: CGPoint(x: padL, y: padT + rankFont.lineHeight - 2),
                    withAttributes: suitAttrs
                )
            }
            drawIndex()

            let centerSize = (suit as NSString).size(withAttributes: centerAttrs)
            (suit as NSString).draw(
                at: CGPoint(x: (size.width - centerSize.width) / 2, y: (size.height - centerSize.height) / 2),
                withAttributes: centerAttrs
            )

            cg.saveGState()
            cg.translateBy(x: size.width, y: size.height)
            cg.rotate(by: .pi)
            drawIndex()
            cg.restoreGState()
        }
    }

    private static func suitUnicode(_ suit: Suit) -> String {
        switch suit {
        case .spades: return "♠"
        case .hearts: return "♥"
        case .diamonds: return "♦"
        case .clubs: return "♣"
        }
    }

    // MARK: - Back

    private static func renderBack(appearance: AppearancePreset) -> UIImage {
        let size = canonicalSize
        let format = UIGraphicsImageRendererFormat()
        format.scale = bakeScale
        format.opaque = false
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let radius = cornerRadius(for: size)
        return renderer.image { ctx in
            let cg = ctx.cgContext
            prepareContext(cg)
            let rect = CGRect(origin: .zero, size: size)
            let back = UIColor(appearance.card.back)
            let backLight = UIColor(appearance.card.backLight)
            let accent = UIColor(appearance.card.backAccent)

            fillVerticalGradient(
                in: rect,
                cornerRadius: radius,
                top: lighterTint(back, amount: 0.04),
                bottom: backLight,
                cg: cg
            )
            addTopBevel(in: rect, cornerRadius: radius, cg: cg)
            strokeDualRim(
                in: rect,
                cornerRadius: radius,
                outer: accent.withAlphaComponent(0.85),
                outerWidth: 1.35,
                innerHighlight: accent.withAlphaComponent(0.28),
                innerWidth: 0.7
            )

            let patternInset: CGFloat = 5.5
            let patternRect = rect.insetBy(dx: patternInset, dy: patternInset)
            let patternRadius = max(2, radius - 3)
            cg.saveGState()
            roundedPath(in: patternRect, radius: patternRadius).addClip()
            drawBackPattern(appearance.card.backPattern, in: patternRect, accent: accent, cg: cg)
            cg.restoreGState()

            let frame = roundedPath(in: patternRect, radius: patternRadius)
            accent.withAlphaComponent(0.55).setStroke()
            frame.lineWidth = 1
            frame.stroke()

            let medallionR = size.width * 0.20
            let medallion = UIBezierPath(
                ovalIn: CGRect(
                    x: size.width / 2 - medallionR,
                    y: size.height / 2 - medallionR,
                    width: medallionR * 2,
                    height: medallionR * 2
                )
            )
            back.withAlphaComponent(0.55).setFill()
            medallion.fill()
            accent.withAlphaComponent(0.75).setStroke()
            medallion.lineWidth = 1.1
            medallion.stroke()

            let starFont = UIFont.systemFont(ofSize: size.width * 0.22, weight: .bold)
            let star = "✦" as NSString
            let attrs: [NSAttributedString.Key: Any] = [.font: starFont, .foregroundColor: accent]
            let starSize = star.size(withAttributes: attrs)
            star.draw(
                at: CGPoint(x: (size.width - starSize.width) / 2, y: (size.height - starSize.height) / 2 - 1),
                withAttributes: attrs
            )
        }
    }

    private static func drawBackPattern(
        _ pattern: CardBackPattern,
        in rect: CGRect,
        accent: UIColor,
        cg: CGContext
    ) {
        switch pattern {
        case .crest:
            let step = max(7, rect.width * 0.14)
            var y = rect.minY - step
            while y < rect.maxY + step {
                var x = rect.minX - step
                while x < rect.maxX + step {
                    let diamond = UIBezierPath()
                    let cx = x + step / 2
                    let cy = y + step / 2
                    let r = step * 0.32
                    diamond.move(to: CGPoint(x: cx, y: cy - r))
                    diamond.addLine(to: CGPoint(x: cx + r, y: cy))
                    diamond.addLine(to: CGPoint(x: cx, y: cy + r))
                    diamond.addLine(to: CGPoint(x: cx - r, y: cy))
                    diamond.close()
                    diamond.lineWidth = 0.7
                    accent.withAlphaComponent(0.22).setStroke()
                    diamond.stroke()
                    x += step
                }
                y += step
            }

        case .seal:
            for i in 1...4 {
                let t = CGFloat(i) / 4.5
                let inset = min(rect.width, rect.height) * t * 0.22
                let ring = UIBezierPath(ovalIn: rect.insetBy(dx: inset, dy: inset * 1.15))
                ring.lineWidth = 0.8
                accent.withAlphaComponent(0.18 + CGFloat(i) * 0.04).setStroke()
                ring.stroke()
            }
            let discR = min(rect.width, rect.height) * 0.08
            accent.withAlphaComponent(0.22).setFill()
            UIBezierPath(
                ovalIn: CGRect(x: rect.midX - discR, y: rect.midY - discR, width: discR * 2, height: discR * 2)
            ).fill()

        case .weave:
            let spacing = max(4.5, rect.width * 0.08)
            cg.saveGState()
            accent.withAlphaComponent(0.16).setStroke()
            cg.setLineWidth(0.65)
            var x = rect.minX - rect.height
            while x < rect.maxX + rect.height {
                cg.move(to: CGPoint(x: x, y: rect.minY))
                cg.addLine(to: CGPoint(x: x + rect.height, y: rect.maxY))
                cg.move(to: CGPoint(x: x, y: rect.maxY))
                cg.addLine(to: CGPoint(x: x + rect.height, y: rect.minY))
                x += spacing
            }
            cg.strokePath()
            cg.restoreGState()

        case .sunburst:
            let rayCount = 16
            let inner = min(rect.width, rect.height) * 0.12
            let outer = min(rect.width, rect.height) * 0.48
            cg.saveGState()
            accent.withAlphaComponent(0.20).setStroke()
            cg.setLineWidth(0.85)
            cg.setLineCap(.round)
            for i in 0..<rayCount {
                let angle = CGFloat(i) / CGFloat(rayCount) * .pi * 2
                let cosA = cos(angle)
                let sinA = sin(angle)
                cg.move(to: CGPoint(x: rect.midX + cosA * inner, y: rect.midY + sinA * inner))
                cg.addLine(to: CGPoint(x: rect.midX + cosA * outer, y: rect.midY + sinA * outer))
            }
            cg.strokePath()
            cg.restoreGState()
        }
    }

    // MARK: - Shadow

    private static func renderShadow() -> UIImage {
        let size = canonicalSize
        let format = UIGraphicsImageRendererFormat()
        format.scale = bakeScale
        format.opaque = false
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let radius = cornerRadius(for: size)
        return renderer.image { ctx in
            prepareContext(ctx.cgContext)
            let rect = CGRect(origin: .zero, size: size)
            let layers: [(CGFloat, CGFloat)] = [
                (0.00, 0.16),
                (0.05, 0.11),
                (0.10, 0.07),
                (0.16, 0.035)
            ]
            for (insetFraction, alpha) in layers {
                let inset = min(size.width, size.height) * insetFraction
                let layerRect = rect.insetBy(dx: inset, dy: inset)
                guard layerRect.width > 2, layerRect.height > 2 else { continue }
                let path = roundedPath(in: layerRect, radius: max(1, radius * (1 - insetFraction * 1.2)))
                UIColor.black.withAlphaComponent(alpha).setFill()
                path.fill()
            }
        }
    }

    private static func rankSymbol(_ rank: Rank) -> String {
        switch rank {
        case .six: return "6"
        case .seven: return "7"
        case .eight: return "8"
        case .nine: return "9"
        case .ten: return "10"
        case .jack: return "J"
        case .queen: return "Q"
        case .king: return "K"
        case .ace: return "A"
        }
    }
}
