// ABOUTME: Haskell code sample for syntax highlighting demo
// ABOUTME: Showcases type signatures, monads, pattern matching, and pure functional programming

import type { CodeSample } from "./types";

export const haskell: CodeSample = {
  id: "haskell",
  name: "Haskell",
  language: "haskell",
  description: "Where side effects go to die and monads go to party",
  code: `-- A module for developers who think imperative programming is too easy
module CaffeineMonad where

import Control.Monad (when, forever)
import Data.Maybe (fromMaybe, isNothing)
import Data.Either (either)

-- | Represents a developer's mental state
data MentalState = Fresh | Tired | Debugging | QuestioningLifeChoices
  deriving (Show, Eq, Ord)

-- | A developer is just a stateful coffee consumption machine
data Developer = Developer
  { name          :: String
  , coffeeLevel   :: Int
  , mentalState   :: MentalState
  , hasSeenMonad  :: Bool
  } deriving (Show)

-- | The legendary Monad explanation attempt
explainMonad :: Developer -> Either String String
explainMonad dev
  | not (hasSeenMonad dev) = Left "A monad is just a monoid in the category of endofunctors, what's the problem?"
  | coffeeLevel dev < 3    = Left "Need more coffee to explain monads"
  | otherwise              = Right "It's like a burrito... no wait, a box... actually, just use >>="

-- | Pure function to calculate productivity (spoiler: it's always Maybe)
calculateProductivity :: Int -> MentalState -> Maybe Double
calculateProductivity coffee state = case state of
  Fresh                   -> Just (fromIntegral coffee * 1.5)
  Tired                   -> if coffee > 5 then Just 0.5 else Nothing
  Debugging               -> Nothing  -- Productivity is a myth
  QuestioningLifeChoices  -> Just (-1.0)  -- Negative productivity

-- | Pattern matching on the existential dread of software development
debugCode :: Maybe String -> String
debugCode Nothing      = "The bug is in the code you didn't write"
debugCode (Just "")    = "Have you tried turning it off and on again?"
debugCode (Just error) = "Error: " ++ error ++ " (this is fine)"

-- | The IO Monad: where pure functions go on vacation
main :: IO ()
main = do
  putStrLn "Starting Haskell program..."
  putStrLn "Evaluating lazily... very lazily..."
  
  let developer = Developer "Alice" 0 Fresh False
  
  -- Functor in action: mapping over Maybe
  let productivity = fmap (* 100) (calculateProductivity 5 Fresh)
  print $ fromMaybe 0 productivity
  
  -- Applicative style because we're fancy
  let addCoffee = (+) <$> Just 3 <*> Just 2
  putStrLn $ "Coffee cups: " ++ show (fromMaybe 0 addCoffee)
  
  -- Monadic bind: the >>= that launched a thousand tutorials
  result <- return developer >>= \\dev ->
    return $ dev { coffeeLevel = 10, hasSeenMonad = True }
  
  -- Either way, we're in trouble
  case explainMonad result of
    Left excuse   -> putStrLn $ "Failed: " ++ excuse
    Right wisdom  -> putStrLn $ "Success: " ++ wisdom
  
  -- List comprehension: SQL for people who hate SQL
  let fibonacci = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
  let evenFibs = [x | x <- fibonacci, even x, x > 0]
  putStrLn $ "Even Fibonacci numbers: " ++ show evenFibs
  
  -- Higher-order functions: because loops are for the weak
  let doubled = map (* 2) [1..5]
  let summed = foldr (+) 0 doubled
  putStrLn $ "The answer to everything: " ++ show summed
  
  -- When you want to do something but only sometimes
  when (coffeeLevel result > 5) $
    putStrLn "Alert: Developer is now mass producing side effects"
  
  putStrLn "Program complete. No mutations were harmed in this execution."

-- | Proof that Haskell developers have a sense of humor
-- (Citation needed)
type Burrito a = Maybe a  -- There, monads explained
`,
};
