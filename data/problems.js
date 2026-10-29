const problems = [
  {
    id: 1,
    title: 'Palindrome check',
    statement: "Read a word from standard input. Print 'palindrome' if it reads the same backward as forward, otherwise print 'not palindrome'.",
    language: 'python',
    starterCode: `def strrev(s):
    rev = ""
    for i in range(len(s)):
        rev = rev + s[len(s) - i - 1]
    return rev

def is_palindrome(s):
    rev = strrev(s)
    if s == rev:
        print("palindrome")
    else:
        print("not palindrome")

main_word = input().strip()
is_palindrome(main_word)`,
     testCases: [
      { input: 'madam\n', expectedOutput: 'palindrome\n', sample: true },
      { input: 'hello\n', expectedOutput: 'not palindrome\n', sample: true },
      { input: 'amma\n', expectedOutput: 'palindrome\n', sample: true },
      { input: 'a\n', expectedOutput: 'palindrome\n' },
      { input: 'abca\n', expectedOutput: 'not palindrome\n' }
    ]
  },
    {
    id: 2,
    title: 'Palindrome check (Java)',
    statement: "Read a word from standard input. Print 'palindrome' if it reads the same backward as forward, otherwise print 'not palindrome'.",
    language: 'java',
    starterCode: `import java.util.Scanner;

public class Solution {

    static String reverse(String s) {
        String rev = "";
        for (int i = 0; i < s.length(); i++) {
            rev = rev + s.charAt(s.length() - i - 1);
        }
        return rev;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String word = sc.next().trim();
        if (word.equals(reverse(word))) {
            System.out.println("palindrome");
        } else {
            System.out.println("not palindrome");
        }
    }
}`,
       testCases: [
      { input: 'madam\n', expectedOutput: 'palindrome\n', sample: true },
      { input: 'hello\n', expectedOutput: 'not palindrome\n', sample: true },
      { input: 'amma\n', expectedOutput: 'palindrome\n', sample: true },
      { input: 'a\n', expectedOutput: 'palindrome\n' },
      { input: 'abca\n', expectedOutput: 'not palindrome\n' }
    ]
  }
];

problems.forEach(p => { p.originalCode = p.starterCode; });

module.exports = problems;