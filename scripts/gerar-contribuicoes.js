const fs = require("node:fs");
const path = require("node:path");

const username = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  throw new Error("GITHUB_USERNAME ou GITHUB_TOKEN não foram definidos.");
}

async function consultarGitHub(query, variables = {}) {
  const resposta = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const dados = await resposta.json();

  if (!resposta.ok || dados.errors) {
    throw new Error(JSON.stringify(dados.errors || dados));
  }

  return dados.data;
}

async function obterContribuicoes(ano) {
  const agora = new Date();
  const fimDoAno = new Date(`${ano}-12-31T23:59:59Z`);
  const fim = fimDoAno > agora ? agora.toISOString() : fimDoAno.toISOString();

  const dados = await consultarGitHub(
    `
      query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
            }
          }
        }
      }
    `,
    {
      login: username,
      from: `${ano}-01-01T00:00:00Z`,
      to: fim,
    }
  );

  return dados.user.contributionsCollection.contributionCalendar.totalContributions;
}

async function main() {
  const dadosDaConta = await consultarGitHub(
    `
      query($login: String!) {
        user(login: $login) {
          createdAt
        }
      }
    `,
    { login: username }
  );

  const anoInicial = new Date(dadosDaConta.user.createdAt).getUTCFullYear();
  const anoAtual = new Date().getUTCFullYear();
  const contribuicoes = [];

  for (let ano = anoInicial; ano <= anoAtual; ano++) {
    contribuicoes.push({
      ano,
      total: await obterContribuicoes(ano),
    });
  }

  const maiorTotal = Math.max(...contribuicoes.map((item) => item.total), 1);
  const largura = 760;
  const altura = 115 + contribuicoes.length * 54;

  const barras = contribuicoes
    .map(({ ano, total }, indice) => {
      const y = 80 + indice * 54;
      const larguraBarra = Math.max(4, Math.round((total / maiorTotal) * 510));

      return `
        <text x="28" y="${y + 20}" fill="#57606a" font-size="16">${ano}</text>
        <rect x="92" y="${y}" width="${larguraBarra}" height="28" rx="7" fill="#2da44e"/>
        <text x="${104 + larguraBarra}" y="${y + 20}" fill="#24292f" font-size="16" font-weight="600">${total}</text>
      `;
    })
    .join("");

  const hoje = new Intl.DateTimeFormat("pt-BR").format(new Date());

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Contribuições no GitHub por ano">
  <rect width="100%" height="100%" rx="12" fill="#ffffff" stroke="#d0d7de"/>
  <text x="28" y="38" fill="#24292f" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700">
    Contribuições por ano
  </text>
  <text x="28" y="61" fill="#57606a" font-family="Segoe UI, Arial, sans-serif" font-size="13">
    Atividade pública no GitHub · Atualizado em ${hoje}
  </text>
  <g font-family="Segoe UI, Arial, sans-serif">
    ${barras}
  </g>
</svg>`.trim();

  const destino = path.join("assets", "contribuicoes-por-ano.svg");
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, svg);

  console.log(`Gráfico criado em ${destino}`);
}

main();
