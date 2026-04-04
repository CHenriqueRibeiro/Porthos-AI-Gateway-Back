const domainProfiles = {
  generic_document: {
    aliases: {
      nome: ["nome", "cliente", "titular", "contratante", "assinante", "paciente"],
      cpf: ["cpf", "documento"],
      cnpj: ["cnpj"],
      telefone: ["telefone", "celular", "fone", "whatsapp", "contato"],
      email: ["email", "e-mail"],
      valor: ["valor", "valor total", "total", "valor em aberto", "valor mensal"],
      vencimento: ["vencimento", "data de vencimento", "data para pagamento"],
      endereco: ["endereço", "endereco", "logradouro", "rua"],
      cidade: ["cidade"],
      bairro: ["bairro"],
      protocolo: ["protocolo", "número do protocolo", "numero do protocolo"],
      numero_contrato: ["contrato", "número do contrato", "numero do contrato"],
      codigo_barras: ["código de barras", "codigo de barras", "linha digitável", "linha digitavel"]
    }
  },

  billing: {
    aliases: {
      nome: ["cliente", "titular", "assinante", "nome"],
      cpf: ["cpf", "documento"],
      cnpj: ["cnpj"],
      telefone: ["telefone", "celular", "fone", "whatsapp", "contato"],
      email: ["email", "e-mail"],
      valor: ["valor", "valor total", "total da fatura", "valor em aberto", "total a pagar"],
      vencimento: ["vencimento", "data de vencimento", "data para pagamento", "data limite"],
      codigo_barras: ["código de barras", "codigo de barras", "linha digitável", "linha digitavel"],
      protocolo: ["protocolo"],
      numero_contrato: ["contrato", "número do contrato", "numero do contrato"]
    }
  },

  clinic_schedule: {
    aliases: {
      nome_paciente: ["paciente", "nome do paciente", "cliente", "nome"],
      cpf: ["cpf", "documento"],
      telefone: ["telefone", "celular", "contato", "whatsapp"],
      email: ["email", "e-mail"],
      especialidade: ["especialidade", "especialista"],
      medico: ["médico", "medico", "doutor", "profissional"],
      data_agendamento: ["data da consulta", "data agendada", "data do agendamento", "data"],
      hora_agendamento: ["hora", "horário", "horario", "hora da consulta"],
      unidade: ["unidade", "clínica", "clinica", "local"]
    }
  },

  restaurant_order: {
    aliases: {
      nome_cliente: ["cliente", "nome", "nome do cliente"],
      telefone: ["telefone", "celular", "contato", "whatsapp"],
      endereco_entrega: ["endereço", "endereco", "rua", "local da entrega", "entrega"],
      valor_total: ["valor total", "total", "total do pedido"],
      forma_pagamento: ["pagamento", "forma de pagamento"],
      observacao: ["observação", "observacao", "obs"],
      numero_pedido: ["pedido", "número do pedido", "numero do pedido"]
    }
  },

  order: {
    aliases: {
      numero_pedido: ["pedido", "número do pedido", "numero do pedido"],
      nome_cliente: ["cliente", "nome do cliente", "nome"],
      cpf: ["cpf", "documento"],
      telefone: ["telefone", "celular", "contato", "whatsapp"],
      email: ["email", "e-mail"],
      valor_total: ["valor total", "total", "total do pedido"],
      status: ["status", "situação", "situacao"],
      endereco_entrega: ["endereço", "endereco", "rua", "entrega"]
    }
  },

  customer_registration: {
    aliases: {
      nome: ["nome", "cliente", "nome completo"],
      cpf: ["cpf", "documento"],
      cnpj: ["cnpj"],
      telefone: ["telefone", "celular", "contato", "whatsapp"],
      email: ["email", "e-mail"],
      endereco: ["endereço", "endereco", "logradouro", "rua"],
      cidade: ["cidade"],
      bairro: ["bairro"]
    }
  }
}

function getDomainProfile(profileName = "generic_document") {
  return domainProfiles[profileName] || domainProfiles.generic_document
}

module.exports = {
  domainProfiles,
  getDomainProfile
}