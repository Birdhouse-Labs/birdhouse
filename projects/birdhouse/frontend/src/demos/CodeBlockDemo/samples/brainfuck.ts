// ABOUTME: Brainfuck code sample for syntax highlighting demo
// ABOUTME: Showcases the world's most hostile programming language with helpful comments

import type { CodeSample } from "./types";

export const brainfuck: CodeSample = {
  id: "brainfuck",
  name: "Brainfuck",
  language: "brainfuck",
  description: "The programming language that looks like your cat walked on your keyboard",
  code: `[ Brainfuck: A language designed to mess with your mind ]
[ Only 8 commands. Infinite regret. ]

[ COMMAND REFERENCE (memorize these, there will be a quiz):
  >  Move pointer right (like Tab, but evil)
  <  Move pointer left (undo your mistake... or make it worse)
  +  Increment cell (counting is hard)
  -  Decrement cell (uncount?)
  .  Output ASCII char (finally, communication!)
  ,  Input ASCII char (user interaction! how modern!)
  [  Jump past ] if cell is 0 (start of "loop" - heavy air quotes)
  ]  Jump back to [ if cell is nonzero (end of suffering... maybe)
]

[ ============================================ ]
[           HELLO WORLD - The Classic          ]
[ ============================================ ]

[ This took someone HOURS to write. Please appreciate it. ]

++++++++               [ Set cell 0 to 8 ]
[                      [ Loop while cell 0 is not 0 ]
    >++++              [ Add 4 to cell 1 ]
    [                  [ Inner loop ]
        >++            [ Add 2 to cell 2 ]
        >+++           [ Add 3 to cell 3 ]
        >+++           [ Add 3 to cell 4 ]
        >+             [ Add 1 to cell 5 ]
        <<<<-          [ Decrement cell 1 ]
    ]
    >+                 [ Add 1 to cell 2 ]
    >+                 [ Add 1 to cell 3 ]
    >-                 [ Subtract 1 from cell 4 ]
    >>+                [ Add 1 to cell 6 ]
    [<]                [ Move back to cell 0 ]
    <-                 [ Decrement cell 0 ]
]

[ Now print "Hello World!" - each . outputs one character ]
>>. Output 'H'
>---.Output 'e'
+++++++..Output 'll' (yes, two chars for the price of one loop)
+++.Output 'o'
>>.Output ' ' (space - the most dramatic character)
<-.Output 'W'
<.Output 'o'
+++.Output 'r'
------.Output 'l'
--------.Output 'd'
>+.Output '!'
>.Output newline

[ ============================================ ]
[     SIMPLE ADDITION: 2 + 3 = 5             ]
[ "Simple" is relative in Brainfuck          ]
[ ============================================ ]

[ Reset and add 2 + 3 ]
[-]>[-]<<    [ Clear cells 0 and 1 ]
++           [ Cell 0 = 2 ]
>+++         [ Cell 1 = 3 ]
[<+>-]       [ Add cell 1 to cell 0, destructively ]
             [ Cell 0 now contains 5! Celebrate! ]

[ To print '5', we need ASCII 53, not the number 5 ]
[ ASCII '0' is 48, so we need to add 48 ]
<++++++++++++++++++++++++++++++++++++++++++++++++. [ Print '5' ]

[ ============================================ ]
[          THE INFINITE WISDOM LOOP           ]
[ ============================================ ]

[ This prints nothing but represents everything ]
[ (It's a comment masquerading as deep code)   ]

[
    Philosophy in Brainfuck:
    
    - Every + has a corresponding -
    - Every < must face its >
    - And somewhere a ] is waiting for its [
    
    This is the way.
]

[ ============================================ ]
[    CAT PROGRAM - Echo input back forever    ]
[ (Finally, something "useful")               ]
[ ============================================ ]

[ Uncomment to run (but you'll regret it):
,[.,]
]

[ That's it. That's the whole program.
  Read char, print if not 0, repeat.
  4 bytes of pure functionality. ]

[ ============================================ ]
[               FUN FACTS                     ]
[ ============================================ ]

[ 
  1. Brainfuck is Turing complete (sorry)
  2. Someone wrote a Brainfuck interpreter in Brainfuck
  3. That person needs a hug
  4. This comment block is the most readable part of any BF program
  5. If you can read this, you're overqualified for this language
]

[ Thanks for reading! May your pointers never overflow ]`,
};
