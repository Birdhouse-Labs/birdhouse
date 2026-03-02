// ABOUTME: Perl code sample for syntax highlighting demo
// ABOUTME: Showcases Perl regex magic, sigils, and the legendary write-only language

import type { CodeSample } from "./types";

export const perl: CodeSample = {
  id: "perl",
  name: "Perl",
  language: "perl",
  description: "There's more than one way to confuse yourself",
  code: `#!/usr/bin/perl
use strict;
use warnings;
use Data::Dumper;  # Because print() is too mainstream

# Perl: The only language where $_, @_, and %_ are completely different things
# and somehow you're expected to know which one is "default"

my $developer_sanity = 100;
my @regexes_written = ();
my %excuses = (
    "it_works"     => "I have no idea how",
    "its_fast"     => "Nobody can read it to prove otherwise", 
    "its_elegant"  => "Stockholm syndrome",
);

# The legendary Perl one-liner that does... something
my $magic = join('', map { chr } (72,101,108,108,111,32,87,111,114,108,100));

# Regex: Because why use 10 lines when 1 unreadable line works?
sub validate_email {
    my ($email) = @_;
    # This regex was found in an ancient tomb
    # The archaeologist who discovered it went mad
    return $email =~ /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
}

# Sigil soup: Perl's way of keeping you humble
sub demonstrate_sigils {
    my @array = (1, 2, 3);
    my $scalar = $array[0];      # $ for scalar from array
    my @slice = @array[0, 1];    # @ for array slice
    my $length = scalar @array;  # scalar() on array for length
    
    # Are you confused yet? Good. That's the Perl way.
    return \\@array;  # Here's a reference, enjoy!
}

# The infamous hash of arrays of hashes
my %nightmare = (
    developers => [
        { name => "Larry", mood => "chaotic_good" },
        { name => "You", mood => "confused" },
    ],
);

# Context-sensitive return: because functions should be mysterious
sub mystery_function {
    my @data = (1, 2, 3, 4, 5);
    return wantarray ? @data : scalar(@data);
    # Caller gets array OR count. Surprise!
}

# TIMTOWTDI in action
for my $excuse (keys %excuses) {
    print "$excuse: $excuses{$excuse}\\n";
    $developer_sanity -= 10;
}

# Alternative syntax because one way is never enough
print "Sanity remaining: $developer_sanity\\n" if $developer_sanity > 0;
$developer_sanity > 0 and print "Still hanging in there!\\n";
$developer_sanity <= 0 or print "This shouldn't print... or should it?\\n";

# The legendary diamond operator
# while (<>) { chomp; process($_); }  # Reads from STDIN or files. Magic!

# Proof that Perl developers have a sense of humor
print "Perl: Making regex look readable since 1987\\n";
print "Just kidding. Nothing makes regex readable.\\n";

__END__
This code after __END__ is ignored.
Perfect for hiding your shame.
Or storing documentation that nobody will read.

=pod

=head1 NAME

chaos.pl - A tribute to Perl's beautiful insanity

=head1 DESCRIPTION  

If you can read this code in 6 months, you didn't write enough Perl.

=cut
`,
};
