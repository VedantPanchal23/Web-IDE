<?php
// PHP Example - Server-side scripting

echo "🐘 Hello from PHP!\n";

// Variables
$message = "PHP powers the web!";
$number = 42;

echo "Message: $message\n";
echo "Number: $number\n";

// Array
$numbers = [1, 2, 3, 4, 5];
echo "Numbers: " . implode(", ", $numbers) . "\n";

// Function
function add($a, $b) {
    return $a + $b;
}

$result = add(10, 20);
echo "10 + 20 = $result\n";

// Associative array
$person = [
    "name" => "John",
    "age" => 30,
    "city" => "New York"
];

echo "\nPerson Info:\n";
foreach ($person as $key => $value) {
    echo "  $key: $value\n";
}

?>
