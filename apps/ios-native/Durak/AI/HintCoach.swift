import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

/// Turns a deterministic strategic hint into short coaching prose via Foundation Models when available.
/// Always falls back to the canned message on older OS, ineligible devices, or errors.
enum HintCoach {
    struct Guidance: Sendable {
        /// Fallback copy shown when FM is unavailable.
        let cannedMessage: String
        /// e.g. "10♠" or nil for take/pass/wait.
        let cardLabel: String?
        /// play | take | pass | wait
        let actionKind: String
        let isTrump: Bool
        let variantName: String
    }

    /// Returns refined coaching text, or `guidance.cannedMessage` if FM cannot run.
    static func refine(_ guidance: Guidance) async -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            return await refineWithFoundationModels(guidance)
        }
        #endif
        return guidance.cannedMessage
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private static func refineWithFoundationModels(_ guidance: Guidance) async -> String {
        let model = SystemLanguageModel.default
        guard model.isAvailable else {
            return guidance.cannedMessage
        }

        let canned = guidance.cannedMessage
        return await withTaskGroup(of: String.self) { group in
            group.addTask {
                do {
                    let session = LanguageModelSession(instructions: """
                        You are a concise Durak (Russian card game) coach.
                        Write one short tip in English for the player, max 18 words.
                        Start with a lightbulb emoji.
                        Never invent a different card or action than the one given.
                        Do not mention AI, models, or that you are a language model.
                        """)

                    let cardBit = guidance.cardLabel.map { " Recommended card: \($0)." } ?? ""
                    let trumpBit = guidance.isTrump ? " It is trump." : ""
                    let prompt = """
                        Variant: \(guidance.variantName).
                        Recommended action: \(guidance.actionKind).\(cardBit)\(trumpBit)
                        Rewrite as a friendly one-line tip that keeps this exact action.
                        """

                    let response = try await session.respond(to: prompt)
                    let text = response.content.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !text.isEmpty else { return canned }
                    if text.contains("💡") { return text }
                    return "💡 \(text)"
                } catch {
                    return canned
                }
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(2.5))
                return canned
            }

            let first = await group.next() ?? canned
            group.cancelAll()
            return first
        }
    }
    #endif
}
