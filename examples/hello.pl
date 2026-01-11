#!/usr/bin/perl
# Perl Example - Text processing powerhouse

use strict;
use warnings;
use v5.10;

say "🐪 Hello from Perl!";

# Variables
my $message = "Perl excels at text processing!";
my $number = 42;

say "Message: $message";
say "Number: $number";

# Array
my @numbers = (1, 2, 3, 4, 5);
say "Numbers: ", join(", ", @numbers);

# Subroutine
sub add {
    my ($a, $b) = @_;
    return $a + $b;
}

my $result = add(10, 20);
say "10 + 20 = $result";

# Hash
my %person = (
    name => "John",
    age => 30,
    city => "New York"
);

say "\nPerson Info:";
foreach my $key (keys %person) {
    say "  $key: $person{$key}";
}
