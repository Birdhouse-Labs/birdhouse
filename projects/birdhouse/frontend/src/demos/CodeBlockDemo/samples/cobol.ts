// ABOUTME: COBOL code sample for syntax highlighting demo
// ABOUTME: Showcases verbose mainframe syntax with maximum enterprise energy

import type { CodeSample } from "./types";

export const cobol: CodeSample = {
  id: "cobol",
  name: "COBOL",
  language: "cobol",
  description: "Written in 1959, still processing your bank transactions in 2024",
  code: `      ******************************************************************
      * PROGRAM-ID: HELLO-ENTERPRISE
      * AUTHOR: A VERY PATIENT PROGRAMMER  
      * DATE-WRITTEN: WHEN DINOSAURS ROAMED THE DATA CENTER
      * PURPOSE: TO PROVE THAT MORE WORDS = BETTER CODE
      * REMARKS: IF YOU CAN READ THIS, CONGRATULATIONS ON YOUR PENSION
      ******************************************************************

       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO-ENTERPRISE.
       AUTHOR. ANCIENT-MAINFRAME-WIZARD.
       INSTALLATION. BUILDING-WITH-NO-WINDOWS.
       DATE-WRITTEN. JANUARY-1-1970.
       DATE-COMPILED. PROBABLY-NEVER-AGAIN.
       SECURITY. SECURITY-THROUGH-OBSCURITY.

      ******************************************************************
      * ENVIRONMENT DIVISION - WHERE WE PRETEND FILES ARE EVERYTHING
      ******************************************************************
       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. IBM-MAINFRAME-FROM-THE-BEFORE-TIMES.
       OBJECT-COMPUTER. WHATEVER-STILL-RUNS-THIS.
       
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT EMPLOYEE-FILE
               ASSIGN TO "EMPLOYEES.DAT"
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FILE-STATUS.

      ******************************************************************
      * DATA DIVISION - 80% OF YOUR COBOL CAREER HAPPENS HERE
      ******************************************************************
       DATA DIVISION.
       FILE SECTION.
       FD EMPLOYEE-FILE.
       01 EMPLOYEE-RECORD.
           05 EMP-ID                    PIC 9(6).
           05 EMP-NAME.
               10 EMP-FIRST-NAME        PIC X(20).
               10 EMP-LAST-NAME         PIC X(20).
           05 EMP-SALARY                PIC 9(7)V99.
           05 EMP-DEPARTMENT            PIC X(10).
           05 EMP-YEARS-OF-SERVICE      PIC 99.
           05 EMP-STILL-USES-COBOL      PIC X VALUE "Y".

       WORKING-STORAGE SECTION.
       01 WS-FILE-STATUS               PIC XX.
       01 WS-EOF-FLAG                  PIC X VALUE "N".
           88 END-OF-FILE              VALUE "Y".
           88 NOT-END-OF-FILE          VALUE "N".
       
       01 WS-COUNTERS.
           05 WS-EMPLOYEE-COUNT        PIC 9(5) VALUE ZEROS.
           05 WS-TOTAL-SALARY          PIC 9(10)V99 VALUE ZEROS.
           05 WS-LINES-OF-CODE         PIC 9(8) VALUE 99999999.
       
       01 WS-DISPLAY-MESSAGES.
           05 WS-WELCOME-MSG           PIC X(50) VALUE
               "WELCOME TO ENTERPRISE HELLO WORLD 3000".
           05 WS-ERROR-MSG             PIC X(50) VALUE
               "ERROR: HAVE YOU TRIED TURNING IT OFF AND ON AGAIN".
           05 WS-SUCCESS-MSG           PIC X(50) VALUE
               "SUCCESS: YOUR TRANSACTION COMPLETED IN ONLY 3 HOURS".

       01 WS-DATE-FIELDS.
           05 WS-CURRENT-DATE.
               10 WS-YEAR              PIC 9(4).
               10 WS-MONTH             PIC 9(2).
               10 WS-DAY               PIC 9(2).
           05 WS-FORMATTED-DATE        PIC X(10).
       
       01 WS-BUSINESS-LOGIC-FLAG       PIC X VALUE SPACES.
           88 BUSINESS-LOGIC-EXISTS    VALUE "Y".
           88 JUST-MOVING-DATA-AROUND  VALUE "N".

      ******************************************************************
      * PROCEDURE DIVISION - WHERE THE MAGIC HAPPENS (SLOWLY)
      ******************************************************************
       PROCEDURE DIVISION.
       
       0000-MAIN-PARAGRAPH.
           PERFORM 1000-INITIALIZATION
           PERFORM 2000-PROCESS-EMPLOYEE-DATA
               UNTIL END-OF-FILE
           PERFORM 3000-DISPLAY-SUMMARY
           PERFORM 9000-TERMINATION
           STOP RUN.

       1000-INITIALIZATION.
           DISPLAY "=========================================="
           DISPLAY WS-WELCOME-MSG
           DISPLAY "=========================================="
           DISPLAY SPACES
           MOVE FUNCTION CURRENT-DATE TO WS-CURRENT-DATE
           DISPLAY "TODAY IS: " WS-YEAR "/" WS-MONTH "/" WS-DAY
           DISPLAY "INITIALIZING ENTERPRISE SYNERGY..."
           DISPLAY SPACES
           OPEN INPUT EMPLOYEE-FILE
           IF WS-FILE-STATUS NOT = "00"
               DISPLAY WS-ERROR-MSG
               DISPLAY "FILE STATUS: " WS-FILE-STATUS
               DISPLAY "PLEASE CONTACT YOUR COBOL SHAMAN"
               STOP RUN
           END-IF
           SET JUST-MOVING-DATA-AROUND TO TRUE.

       2000-PROCESS-EMPLOYEE-DATA.
           READ EMPLOYEE-FILE
               AT END
                   SET END-OF-FILE TO TRUE
               NOT AT END
                   PERFORM 2100-CALCULATE-EMPLOYEE-VALUE
           END-READ.

       2100-CALCULATE-EMPLOYEE-VALUE.
           ADD 1 TO WS-EMPLOYEE-COUNT
           ADD EMP-SALARY TO WS-TOTAL-SALARY
           
           IF EMP-STILL-USES-COBOL = "Y"
               DISPLAY "EMPLOYEE " EMP-ID ": " 
                       EMP-FIRST-NAME " " EMP-LAST-NAME
               DISPLAY "  STATUS: IRREPLACEABLE UNTIL RETIREMENT"
               DISPLAY "  SALARY: WHATEVER THEY WANT"
           ELSE
               DISPLAY "EMPLOYEE " EMP-ID ": PROBABLY ALREADY LEFT"
           END-IF.

       3000-DISPLAY-SUMMARY.
           DISPLAY SPACES
           DISPLAY "=========================================="
           DISPLAY "          EXECUTIVE SUMMARY               "
           DISPLAY "=========================================="
           DISPLAY "EMPLOYEES PROCESSED: " WS-EMPLOYEE-COUNT
           DISPLAY "TOTAL SALARY BURDEN: $" WS-TOTAL-SALARY
           DISPLAY "LINES OF CODE: " WS-LINES-OF-CODE
           DISPLAY "AVERAGE AGE OF CODEBASE: OLDER THAN YOU"
           DISPLAY "PROBABILITY OF REWRITE: 0.00%"
           DISPLAY WS-SUCCESS-MSG.

       9000-TERMINATION.
           CLOSE EMPLOYEE-FILE
           DISPLAY SPACES
           DISPLAY "TRANSACTION COMPLETE. SEE YOU NEXT QUARTER."
           DISPLAY "REMEMBER: COBOL DEVELOPERS NEVER DIE,"
           DISPLAY "          THEY JUST LOSE THEIR PUNCH CARDS."
           DISPLAY SPACES.

      ******************************************************************
      * END OF PROGRAM
      * ESTIMATED MAINTENANCE COST: YOUR ENTIRE IT BUDGET
      * ESTIMATED REPLACEMENT DATE: HEAT DEATH OF UNIVERSE
      ******************************************************************`,
};
