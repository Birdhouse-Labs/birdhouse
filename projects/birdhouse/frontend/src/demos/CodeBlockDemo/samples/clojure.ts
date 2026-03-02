// ABOUTME: Clojure code sample for syntax highlighting demo
// ABOUTME: Showcases LISP parentheses, immutable data, atoms, and functional programming

import type { CodeSample } from "./types";

export const clojure: CodeSample = {
  id: "clojure",
  name: "Clojure",
  language: "clojure",
  description: "A parenthesis-powered coffee shop simulator - because (((Lisp))) never has enough parens",
  code: `;; Welcome to ClojureScript Coffee Co.
;; Where we have more parentheses than actual coffee

(ns coffee-shop.core
  (:require [clojure.string :as str]))

;; Immutable menu - good luck changing these prices!
(def menu
  {:espresso     {:price 3.50  :caffeine 150 :pretentiousness 2}
   :latte        {:price 5.00  :caffeine 100 :pretentiousness 5}
   :cold-brew    {:price 6.00  :caffeine 200 :pretentiousness 7}
   :pumpkin-spice {:price 7.50 :caffeine 80  :pretentiousness 10}
   :plain-coffee {:price 2.00  :caffeine 120 :pretentiousness 0}})

;; State management with atoms - the only mutable thing here
(def cash-register (atom 0))
(def orders-today (atom []))
(def barista-mood (atom :caffeinated))

;; Multi-arity function - because one function is never enough
(defn make-coffee
  "Makes coffee. May or may not include existential dread."
  ([drink]
   (make-coffee drink :regular))
  ([drink size]
   (make-coffee drink size false))
  ([drink size extra-shot?]
   (let [base-drink (get menu drink)
         size-multiplier (case size
                           :small 0.8
                           :regular 1.0
                           :large 1.3
                           :why-even-bother 2.0)
         price (* (:price base-drink) size-multiplier)
         caffeine (+ (:caffeine base-drink) (if extra-shot? 75 0))]
     {:drink drink
      :size size
      :price (Math/round (* price 100.0) 0.01)
      :caffeine caffeine
      :served-with-judgment (> (:pretentiousness base-drink) 5)})))

;; Threading macro magic - because reading left-to-right is overrated
(defn process-order [customer-name drink]
  (->> (make-coffee drink :large true)
       (assoc :customer customer-name)
       (assoc :timestamp (System/currentTimeMillis))
       (#(do
           (swap! cash-register + (:price %))
           (swap! orders-today conj %)
           %))
       (tap (fn [order]
              (println (str "☕ " customer-name " ordered " (name drink)))))))

;; Destructuring everything - we love unpacking things
(defn print-receipt [{:keys [customer drink price caffeine served-with-judgment]}]
  (println (str/join "\\n"
    [(str "━━━━━━━━━━━━━━━━━━━━━━")
     (str "Customer: " customer)
     (str "Drink: " (name drink))
     (str "Price: $" (format "%.2f" price))
     (str "Caffeine: " caffeine "mg")
     (when served-with-judgment
       "⚠️  Your order has been silently judged")
     (str "━━━━━━━━━━━━━━━━━━━━━━")])))

;; Higher-order function chaos
(defn analyze-caffeine-addiction [orders]
  (let [total-caffeine (reduce + (map :caffeine orders))
        avg-pretentiousness (/ (reduce + (map #(get-in menu [(:drink %) :pretentiousness]) orders))
                               (max 1 (count orders)))
        addiction-level (cond
                          (> total-caffeine 500) :seeking-help
                          (> total-caffeine 300) :functional-addict  
                          (> total-caffeine 100) :casual-user
                          :else :clearly-a-tea-person)]
    {:total-caffeine total-caffeine
     :pretentiousness-score avg-pretentiousness
     :diagnosis addiction-level
     :recommendation (if (> avg-pretentiousness 5)
                       "Maybe try just... regular coffee?"
                       "You're doing great, keep it simple!")}))

;; Lazy sequences - we'll compute it eventually, maybe
(def infinite-coffee-supply
  (lazy-seq
    (cons (rand-nth (keys menu))
          infinite-coffee-supply)))

;; Pattern matching with core.match vibes using cond
(defn barista-response [mood order-count]
  (cond
    (and (= mood :caffeinated) (< order-count 10))
    "Good morning! What can I get you? 😊"
    
    (and (= mood :caffeinated) (>= order-count 10))
    "Welcome! *internally screaming* How can I help?"
    
    (= mood :decaffeinated)
    "...what."
    
    (= mood :existential-crisis)
    "Have you ever wondered if the coffee drinks us?"
    
    :else
    "Error 418: I'm a teapot"))

;; Let's run this beautiful parenthetical nightmare
(defn -main []
  (println "\\n🏪 ClojureScript Coffee Co. is now open!\\n")
  
  ;; Process some orders
  (doseq [[name drink] [["Alice" :espresso]
                        ["Bob" :pumpkin-spice]
                        ["Charlie" :cold-brew]
                        ["Dave" :plain-coffee]]]
    (process-order name drink))
  
  ;; Analyze the damage
  (println "\\n📊 End of Day Analysis:")
  (let [analysis (analyze-caffeine-addiction @orders-today)]
    (println (str "Total caffeine dispensed: " (:total-caffeine analysis) "mg"))
    (println (str "Diagnosis: " (name (:diagnosis analysis))))
    (println (str "Revenue: $" @cash-register)))
  
  (println (str "\\n" (barista-response @barista-mood (count @orders-today)))))

;; All those parentheses? That's not a bug, it's a feature.
;; (((((((( LISP INTENSIFIES ))))))))`,
};
