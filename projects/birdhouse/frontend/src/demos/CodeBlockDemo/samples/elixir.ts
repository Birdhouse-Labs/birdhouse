// ABOUTME: Elixir code sample for syntax highlighting demo
// ABOUTME: Demonstrates GenServer, pattern matching, pipe operator, and "let it crash" philosophy

import type { CodeSample } from "./types";

export const elixir: CodeSample = {
  id: "elixir",
  name: "Elixir",
  language: "elixir",
  description: "A fault-tolerant coffee brewing system that embraces chaos",
  code: `# Let it crash: A philosophy for both Elixir and Monday mornings

defmodule CoffeeShop.Barista do
  @moduledoc """
  A GenServer that makes coffee and handles existential crises.
  If it crashes, the supervisor will just hire a new barista.
  """
  use GenServer

  # Client API - for those who just want coffee

  def start_link(name) do
    GenServer.start_link(__MODULE__, %{name: name, coffees_made: 0, mood: :caffeinated})
  end

  def order(pid, drink), do: GenServer.call(pid, {:order, drink})
  def check_mood(pid), do: GenServer.call(pid, :mood)
  def take_break(pid), do: GenServer.cast(pid, :break)

  # Server Callbacks - where the magic (and crashes) happen

  @impl true
  def init(state) do
    IO.puts("☕ Barista #{state.name} clocked in. Let's brew some chaos!")
    {:ok, state}
  end

  @impl true
  def handle_call({:order, drink}, _from, state) do
    result = drink
             |> validate_order()
             |> grind_beans()
             |> brew()
             |> add_pretentious_latte_art()

    new_state = %{state | coffees_made: state.coffees_made + 1}
    {:reply, result, update_mood(new_state)}
  end

  def handle_call(:mood, _from, state) do
    response = case state.mood do
      :caffeinated -> "Vibing ✨"
      :overcaffeinated -> "I CAN SEE SOUNDS 👁️"
      :decaf -> "Why even bother existing?"
    end
    {:reply, response, state}
  end

  @impl true
  def handle_cast(:break, state) do
    IO.puts("💤 #{state.name} is scrolling Twitter... I mean taking a break")
    Process.sleep(1000)
    {:noreply, %{state | mood: :caffeinated}}
  end

  # The beautiful pipe operator in action
  defp validate_order(drink) when drink in [:espresso, :latte, :cappuccino, :americano] do
    {:ok, drink}
  end
  defp validate_order(:decaf), do: raise "We don't serve that here. This is a place of dignity."
  defp validate_order(drink), do: {:error, "What even is a #{drink}?"}

  defp grind_beans({:ok, drink}) do
    grind_time = :rand.uniform(100)
    IO.puts("  🫘 Grinding beans for #{grind_time}ms (artisanally)")
    {:ok, drink, :ground}
  end
  defp grind_beans(error), do: error

  defp brew({:ok, drink, :ground}) do
    # Pattern matching: Elixir's way of saying "I expected this"
    pressure = case drink do
      :espresso -> 9.0
      :americano -> 9.0
      _ -> 8.5
    end
    IO.puts("  💨 Brewing at #{pressure} bars of pressure")
    {:ok, drink, :brewed}
  end
  defp brew(error), do: error

  defp add_pretentious_latte_art({:ok, drink, :brewed}) do
    art = Enum.random(["🌸 rosetta", "🍃 leaf", "🦢 swan", "👽 alien (it was an accident)"])
    IO.puts("  🎨 Added #{art}")
    {:ok, %{drink: drink, art: art, instagram_worthy: true}}
  end
  defp add_pretentious_latte_art(error), do: error

  defp update_mood(state) do
    cond do
      state.coffees_made > 100 -> %{state | mood: :overcaffeinated}
      state.coffees_made > 50 -> %{state | mood: :caffeinated}
      true -> state
    end
  end
end

# Supervisor: Because baristas are unreliable
defmodule CoffeeShop.Supervisor do
  use Supervisor

  def start_link(_) do
    Supervisor.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @impl true
  def init(:ok) do
    children = [
      # If a barista crashes (orders decaf), restart them immediately
      # This is the "let it crash" philosophy in action
      %{
        id: :barista_1,
        start: {CoffeeShop.Barista, :start_link, ["Alex"]}
      },
      %{
        id: :barista_2,
        start: {CoffeeShop.Barista, :start_link, ["Jordan"]}
      }
    ]

    # one_for_one: If one barista has a breakdown, only restart that one
    # Because their trauma is their own
    Supervisor.init(children, strategy: :one_for_one)
  end
end

# Demo time!
{:ok, pid} = CoffeeShop.Barista.start_link("Demo Barista")

[:espresso, :latte, :cappuccino]
|> Enum.each(fn drink ->
  IO.puts("\\n📋 Ordering: #{drink}")
  case CoffeeShop.Barista.order(pid, drink) do
    {:ok, result} -> IO.puts("  ✅ Got my #{result.drink} with #{result.art}!")
    {:error, msg} -> IO.puts("  ❌ #{msg}")
  end
end)

IO.puts("\\n🎭 Barista mood: #{CoffeeShop.Barista.check_mood(pid)}")`,
};
