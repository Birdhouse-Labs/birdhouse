// ABOUTME: Fortran code sample for syntax highlighting demo
// ABOUTME: Showcases scientific computing, arrays, DO loops, and IMPLICIT NONE with humor

import type { CodeSample } from "./types";

export const fortran: CodeSample = {
  id: "fortran",
  name: "Fortran",
  language: "fortran-free-form",
  description: "Computing like it's 1957 (but with better arrays)",
  code: `PROGRAM DINOSAUR_SIMULATOR
! ABOUTME: Simulates dinosaur behavior using cutting-edge 1957 technology
! ABOUTME: Proves that real programmers don't need lowercase letters

      IMPLICIT NONE

      INTEGER, PARAMETER :: NUM_DINOSAURS = 42
      INTEGER, PARAMETER :: DAYS_UNTIL_ASTEROID = 65000000

      REAL*8 :: hunger_levels(NUM_DINOSAURS)
      REAL*8 :: roar_volume(NUM_DINOSAURS)
      REAL*8 :: extinction_probability
      CHARACTER(LEN=20) :: dinosaur_names(5)

      INTEGER :: i, day
      LOGICAL :: still_alive

      ! Initialize our prehistoric friends
      dinosaur_names(1) = 'T-REX'
      dinosaur_names(2) = 'VELOCIRAPTOR'
      dinosaur_names(3) = 'COBOL-ASAURUS'
      dinosaur_names(4) = 'FORTRAN-ODON'
      dinosaur_names(5) = 'PUNCH-CARD-ICUS'

      still_alive = .TRUE.
      extinction_probability = 0.0D0

      WRITE(*,*) '=== WELCOME TO JURASSIC FORTRAN ==='
      WRITE(*,*) 'Where arrays start at 1, as God intended'
      WRITE(*,*)

      ! Initialize hunger using a VERY IMPORTANT scientific formula
      DO i = 1, NUM_DINOSAURS
          hunger_levels(i) = DBLE(i) * 3.14159D0
          roar_volume(i) = 120.0D0 - DBLE(MOD(i, 10))
      END DO

      ! Main simulation loop (runs until meteor)
      DO day = 1, 100
          CALL SIMULATE_FEEDING(hunger_levels, NUM_DINOSAURS)
          CALL CALCULATE_ROAR_INTENSITY(roar_volume, NUM_DINOSAURS)

          extinction_probability = extinction_probability + 0.00001D0

          IF (MOD(day, 25) .EQ. 0) THEN
              WRITE(*,'(A,I4,A,F8.4,A)') 'Day ', day, &
                  ': Extinction risk = ', extinction_probability * 100.0D0, '%'
          END IF
      END DO

      WRITE(*,*)
      WRITE(*,*) 'Simulation complete!'
      WRITE(*,*) 'The dinosaurs have survived... for now.'
      WRITE(*,*) '(This program compiled on a computer the size of a room)'

      CONTAINS

      SUBROUTINE SIMULATE_FEEDING(hunger, n)
          INTEGER, INTENT(IN) :: n
          REAL*8, INTENT(INOUT) :: hunger(n)
          INTEGER :: j

          DO j = 1, n
              ! Dinosaurs get hungry at a rate of PI per day
              ! (this is peer-reviewed science)
              hunger(j) = hunger(j) + 3.14159D0
              IF (hunger(j) .GT. 100.0D0) THEN
                  hunger(j) = 0.0D0  ! Found a lawyer to eat
              END IF
          END DO
      END SUBROUTINE SIMULATE_FEEDING

      SUBROUTINE CALCULATE_ROAR_INTENSITY(volume, n)
          INTEGER, INTENT(IN) :: n
          REAL*8, INTENT(INOUT) :: volume(n)
          INTEGER :: k

          DO k = 1, n
              ! Roar volume increases with hunger (obviously)
              volume(k) = MIN(volume(k) * 1.01D0, 150.0D0)
          END DO
      END SUBROUTINE CALCULATE_ROAR_INTENSITY

END PROGRAM DINOSAUR_SIMULATOR`,
};
