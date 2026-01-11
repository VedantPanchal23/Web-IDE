#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

int main() {
    std::cout << "⚡ Hello from C++!" << std::endl;
    std::cout << "==============================" << std::endl;
    
    // Variables
    std::string projectName = "AI-IDE";
    std::cout << "Welcome to " << projectName << "!" << std::endl;
    
    // Vector operations
    std::vector<int> numbers = {1, 2, 3, 4, 5};
    std::vector<int> squares;
    
    // Transform to squares
    std::transform(numbers.begin(), numbers.end(), 
                   std::back_inserter(squares),
                   [](int n) { return n * n; });
    
    std::cout << "Numbers: ";
    for (size_t i = 0; i < numbers.size(); ++i) {
        std::cout << numbers[i];
        if (i < numbers.size() - 1) std::cout << ", ";
    }
    std::cout << std::endl;
    
    std::cout << "Squares: ";
    for (size_t i = 0; i < squares.size(); ++i) {
        std::cout << squares[i];
        if (i < squares.size() - 1) std::cout << ", ";
    }
    std::cout << std::endl;
    
    // String operations
    std::string message = "C++ execution in AI-IDE works great!";
    std::cout << "Message: " << message << std::endl;
    std::cout << "Length: " << message.length() << std::endl;
    
    std::cout << "\n✅ C++ execution complete!" << std::endl;
    return 0;
}